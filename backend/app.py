from spatial_map import spatial_map_bp
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
import base64
import io
import sqlite3
from datetime import datetime, timedelta
import json
import numpy as np
from PIL import Image
import cv2
import sys
import threading
import uuid
import logging
from atexit import register

# Import Simulation Module
try:
    from simulation.litter_simulation import run_backtracking_simulation
    from simulation import config as sim_config
    SIMULATION_AVAILABLE = True
    print(f"Simulation module loaded from backend.simulation")
except ImportError as e:
    print(f"WARNING: Simulation module not available: {e}")
    SIMULATION_AVAILABLE = False

# Import Scheduler
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    SCHEDULER_AVAILABLE = True
except ImportError:
    SCHEDULER_AVAILABLE = False
    print("WARNING: APScheduler not installed. Install with: pip install apscheduler")

# Import YOLO
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("WARNING: ultralytics not installed. Install with: pip install ultralytics")

app = Flask(__name__)
app.register_blueprint(spatial_map_bp)   # ← Spatial Map blueprint
CORS(app)

# Configuration
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH    = os.path.join(BASE_DIR, 'models', 'best.pt')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
RESULTS_FOLDER = os.path.join(BASE_DIR, 'results')
DATABASE_PATH  = os.path.join(BASE_DIR, 'database.db')

os.makedirs(UPLOAD_FOLDER,  exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

# Load YOLO model
yolo_model = None
if YOLO_AVAILABLE and os.path.exists(MODEL_PATH):
    try:
        print(f"Loading YOLO model from {MODEL_PATH}...")
        yolo_model = YOLO(MODEL_PATH)
        print(f"YOLO model loaded successfully!")
        print(f"Model classes: {yolo_model.names}")
    except Exception as e:
        print(f"Error loading YOLO model: {e}")
else:
    if not YOLO_AVAILABLE:
        print("YOLO not available - please install ultralytics")
    else:
        print(f"Model file not found at {MODEL_PATH}")
        print("Please copy your YOLO .pt model to backend/models/best.pt")


# ─── Database Init ─────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    # Tabel deteksi — ditambahkan kolom latitude & longitude
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS detections (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            location     TEXT    NOT NULL,
            latitude     REAL,
            longitude    REAL,
            image_path   TEXT    NOT NULL,
            result_path  TEXT,
            plastic_bag  INTEGER DEFAULT 0,
            bottle       INTEGER DEFAULT 0,
            wrapper      INTEGER DEFAULT 0,
            total_items  INTEGER DEFAULT 0,
            confidence   REAL    DEFAULT 0,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Tambah kolom lat/lon jika tabel lama belum punya (migrasi)
    for col, coltype in [('latitude', 'REAL'), ('longitude', 'REAL')]:
        try:
            cursor.execute(f"ALTER TABLE detections ADD COLUMN {col} {coltype}")
            print(f"Kolom '{col}' ditambahkan ke tabel detections.")
        except Exception:
            pass  # Sudah ada, skip

    # Tabel akumulasi
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS accumulations (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            location     TEXT    NOT NULL UNIQUE,
            total_items  INTEGER DEFAULT 0,
            plastic_bag  INTEGER DEFAULT 0,
            bottle       INTEGER DEFAULT 0,
            wrapper      INTEGER DEFAULT 0,
            total_uploads INTEGER DEFAULT 0,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute("INSERT OR IGNORE INTO accumulations (location) VALUES ('Takalar')")
    cursor.execute("INSERT OR IGNORE INTO accumulations (location) VALUES ('Mamuju')")

    conn.commit()
    conn.close()
    print("Database initialized successfully!")

init_db()


# ─── Health Check ──────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok',
        'yolo_available': yolo_model is not None,
        'model_path': MODEL_PATH,
        'model_exists': os.path.exists(MODEL_PATH)
    })


# ─── Simulation Jobs ───────────────────────────────────────────────────────────
SIMULATION_JOBS = {}


def cleanup_old_simulations(max_age_hours=24):
    try:
        static_sim_dir = os.path.join(BASE_DIR, 'static', 'simulations')
        if not os.path.exists(static_sim_dir):
            return
        now = datetime.now()
        count = 0
        for filename in os.listdir(static_sim_dir):
            file_path = os.path.join(static_sim_dir, filename)
            file_time = datetime.fromtimestamp(os.path.getmtime(file_path))
            if now - file_time > timedelta(hours=max_age_hours):
                try:
                    os.remove(file_path)
                    count += 1
                except Exception as e:
                    print(f"Error deleting old file {filename}: {e}")
        expired_jobs = [
            jid for jid, job in SIMULATION_JOBS.items()
            if datetime.now() - datetime.fromisoformat(job['created_at']) > timedelta(hours=max_age_hours)
        ]
        for jid in expired_jobs:
            del SIMULATION_JOBS[jid]
        if count > 0:
            print(f"Cleaned up {count} old simulation files and {len(expired_jobs)} job records.")
    except Exception as e:
        print(f"Cleanup error: {e}")


@app.route('/api/simulate/<job_id>', methods=['GET'])
def get_simulation_status(job_id):
    job = SIMULATION_JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


@app.route('/api/simulate', methods=['POST'])
def start_simulation():
    if not SIMULATION_AVAILABLE:
        return jsonify({"error": "Simulation module not loaded"}), 503
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No input data provided"}), 400
        try:
            lat        = float(data.get('lat', -5.15))
            lon        = float(data.get('lon', 119.42))
            days       = int(data.get('days', 3))
            particles  = int(data.get('particles', 100))
            start_date = data.get('start_time', datetime.now().strftime("%Y-%m-%d"))
        except ValueError as e:
            return jsonify({"error": f"Invalid input format: {str(e)}"}), 400

        if not (-90 <= lat <= 90):
            return jsonify({"error": "Latitude must be between -90 and 90"}), 400
        if not (-180 <= lon <= 180):
            return jsonify({"error": "Longitude must be between -180 and 180"}), 400
        if days < 1 or days > 30:
            return jsonify({"error": "Days must be between 1 and 30"}), 400
        if particles < 1 or particles > 5000:
            return jsonify({"error": "Particles must be between 1 and 5000"}), 400

        if not SCHEDULER_AVAILABLE:
            threading.Thread(target=cleanup_old_simulations).start()

        job_id = str(uuid.uuid4())
        start_time_str = f"{start_date} 12:00:00" if len(start_date) == 10 else start_date

        static_sim_dir = os.path.join(BASE_DIR, 'static', 'simulations')
        os.makedirs(static_sim_dir, exist_ok=True)

        SIMULATION_JOBS[job_id] = {
            "id": job_id, "status": "pending", "progress": 0,
            "created_at": datetime.now().isoformat(), "params": data
        }

        def run_job(jid, output_dir):
            try:
                SIMULATION_JOBS[jid]["status"] = "running"
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename  = f"sim_{timestamp}_{jid[:8]}.nc"
                results   = run_backtracking_simulation(
                    lat=lat, lon=lon, start_time=start_time_str,
                    days=days, particles=particles,
                    out_filename=filename, plot=True, verbose=False,
                    output_dir=output_dir
                )
                file_urls = {}
                stats     = {}
                for key, value in results.items():
                    if key == "stats":
                        stats = value
                    elif isinstance(value, str) and os.path.exists(value):
                        file_urls[key] = f"/static/simulations/{os.path.basename(value)}"
                SIMULATION_JOBS[jid].update({
                    "status": "completed", "files": file_urls,
                    "stats": stats, "completed_at": datetime.now().isoformat()
                })
            except Exception as e:
                import traceback; traceback.print_exc()
                SIMULATION_JOBS[jid].update({"status": "failed", "error": str(e)})

        threading.Thread(target=run_job, args=(job_id, static_sim_dir)).start()
        return jsonify({"status": "submitted", "job_id": job_id,
                        "message": "Simulation started in background"})

    except Exception as e:
        print(f"Simulation submission failed: {e}")
        return jsonify({"error": str(e)}), 500


# ─── Coordinate Scatter ────────────────────────────────────────────────────────
import random
import math

# Radius scatter dalam derajat.
# 0.008° ≈ ~900 m — titik-titik menyebar natural dalam radius ~1 km dari pusat.
# Distribusi Gaussian: sebagian besar titik dekat pusat, sedikit lebih jauh.
SCATTER_RADIUS_DEG = 0.008

def scatter_coordinate(lat, lon):
    """
    Tambahkan offset Gaussian kecil ke koordinat agar titik-titik
    yang berasal dari lokasi yang sama tidak tumpuk di satu titik.
    
    Menggunakan Box-Muller transform untuk distribusi normal 2D.
    Radius ≈ 0–1.5 km dari titik pusat.
    """
    if lat is None or lon is None:
        return lat, lon

    # Box-Muller: hasilkan dua nilai normal independen
    u1 = random.random() or 1e-10   # hindari log(0)
    u2 = random.random()
    mag = SCATTER_RADIUS_DEG * math.sqrt(-2.0 * math.log(u1))
    dlat = mag * math.cos(2 * math.pi * u2)
    dlon = mag * math.sin(2 * math.pi * u2)

    # Koreksi longitude agar jarak fisiknya setara (1° lon < 1° lat di lintang tinggi)
    lat_rad = math.radians(lat)
    dlon = dlon / max(math.cos(lat_rad), 0.01)

    return round(lat + dlat, 7), round(lon + dlon, 7)


# ─── Detection ─────────────────────────────────────────────────────────────────
@app.route('/api/detect', methods=['POST'])
def detect_waste():
    try:
        if yolo_model is None:
            return jsonify({
                'error': 'YOLO model not loaded',
                'message': 'Please ensure your YOLO .pt model is in backend/models/ folder'
            }), 500

        data       = request.json
        location   = data.get('location')
        image_b64  = data.get('image')
        latitude   = data.get('latitude',  None)
        longitude  = data.get('longitude', None)

        # Scatter koordinat agar titik-titik tidak tumpuk di satu titik
        # pada spatial map ketika banyak gambar diupload dari lokasi yang sama.
        scattered_lat, scattered_lon = scatter_coordinate(latitude, longitude)

        if not location or not image_b64:
            return jsonify({'error': 'Missing location or image'}), 400

        if ',' in image_b64:
            image_b64 = image_b64.split(',')[1]

        image_bytes = base64.b64decode(image_b64)
        image       = Image.open(io.BytesIO(image_bytes))

        timestamp        = datetime.now().strftime('%Y%m%d_%H%M%S')
        image_filename   = f"{location}_{timestamp}.jpg"
        image_path       = os.path.join(UPLOAD_FOLDER, image_filename)
        image.save(image_path)

        image_np = np.array(image)
        results  = yolo_model(image_np)

        detection_counts = {}
        total_items      = 0
        confidences      = []

        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls_id     = int(box.cls[0])
                conf       = float(box.conf[0])
                class_name = yolo_model.names[cls_id]
                detection_counts[class_name] = detection_counts.get(class_name, 0) + 1
                total_items += 1
                confidences.append(conf)

        plastic_bag = sum(detection_counts.get(n, 0) for n in ['plastic_bag', 'bag', 'plastik'])
        bottle      = sum(detection_counts.get(n, 0) for n in ['bottle', 'botol'])
        wrapper     = sum(detection_counts.get(n, 0) for n in ['wrapper', 'kemasan', 'packaging'])

        if not plastic_bag and not bottle and not wrapper and total_items > 0:
            classes = list(detection_counts.keys())
            if len(classes) >= 3:
                plastic_bag = detection_counts.get(classes[0], 0)
                bottle      = detection_counts.get(classes[1], 0)
                wrapper     = detection_counts.get(classes[2], 0)
            elif len(classes) == 2:
                plastic_bag = detection_counts.get(classes[0], 0)
                bottle      = detection_counts.get(classes[1], 0)
            elif len(classes) == 1:
                plastic_bag = detection_counts.get(classes[0], 0)

        avg_confidence   = np.mean(confidences) if confidences else 0
        result_image     = results[0].plot()
        result_filename  = f"{location}_{timestamp}_result.jpg"
        result_path      = os.path.join(RESULTS_FOLDER, result_filename)
        result_image_bgr = cv2.cvtColor(result_image, cv2.COLOR_RGB2BGR)
        cv2.imwrite(result_path, result_image_bgr)

        conn   = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()

        # Simpan koordinat yang sudah di-scatter agar titik tidak tumpuk di peta
        cursor.execute('''
            INSERT INTO detections
            (location, latitude, longitude, image_path, result_path,
             plastic_bag, bottle, wrapper, total_items, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (location, scattered_lat, scattered_lon, image_path, result_path,
              plastic_bag, bottle, wrapper, total_items, avg_confidence))

        cursor.execute('''
            UPDATE accumulations
            SET total_items   = total_items   + ?,
                plastic_bag   = plastic_bag   + ?,
                bottle        = bottle        + ?,
                wrapper       = wrapper       + ?,
                total_uploads = total_uploads + 1,
                last_updated  = CURRENT_TIMESTAMP
            WHERE location = ?
        ''', (total_items, plastic_bag, bottle, wrapper, location))

        conn.commit()
        cursor.execute('SELECT * FROM accumulations WHERE location = ?', (location,))
        acc_row = cursor.fetchone()
        conn.close()

        waste_types = {
            'Kantong Plastik': plastic_bag,
            'Botol Plastik':   bottle,
            'Kemasan/Wrapper': wrapper
        }
        dominant = max(waste_types.items(), key=lambda x: x[1])

        with open(result_path, 'rb') as f:
            result_b64 = base64.b64encode(f.read()).decode('utf-8')

        return jsonify({
            'success': True,
            'data': {
                'location':       location,
                'latitude':       latitude,        # koordinat asli yang diinput user
                'longitude':      longitude,       # koordinat asli yang diinput user
                'total_detected': total_items,
                'confidence':     round(avg_confidence * 100, 1),
                'dominant': {
                    'name':       dominant[0],
                    'count':      dominant[1],
                    'percentage': round(dominant[1] / total_items * 100, 1) if total_items > 0 else 0
                },
                'breakdown': {
                    'plastic_bag': plastic_bag,
                    'bottle':      bottle,
                    'wrapper':     wrapper
                },
                'all_detections': detection_counts,
                'result_image':   f'data:image/jpeg;base64,{result_b64}',
                'accumulation': {
                    'total':       acc_row[2],
                    'plastic_bag': acc_row[3],
                    'bottle':      acc_row[4],
                    'wrapper':     acc_row[5],
                    'uploads':     acc_row[6]
                } if acc_row else None
            }
        })

    except Exception as e:
        import traceback; traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/static/simulations/<path:filename>')
def serve_simulation_file(filename):
    return send_from_directory(os.path.join(app.static_folder, 'simulations'), filename)


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("MarineTrace Backend Server")
    print("=" * 60)
    print(f"YOLO Model : {'✓ Loaded' if yolo_model else '✗ Not loaded'}")
    print(f"Database   : ✓ Initialized (with lat/lon support)")
    print(f"Spatial Map: ✓ Blueprint registered")

    if SCHEDULER_AVAILABLE:
        if os.environ.get('WERKZEUG_RUN_MAIN') == 'true':
            scheduler = BackgroundScheduler()
            scheduler.add_job(cleanup_old_simulations, 'interval', hours=1)
            scheduler.start()
            print("Scheduler  : ✓ Started")
            register(lambda: scheduler.shutdown())
    else:
        print("Scheduler  : ✗ Not available (using fallback)")

    print(f"Server     : http://localhost:5000")
    print("=" * 60 + "\n")

    app.run(debug=True, host='0.0.0.0', port=5000)
