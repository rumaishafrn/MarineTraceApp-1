"""
Spatial Map Feature - MarineTraceApp
Fitur ke-3: Mapping Spasial Sampah
"""

from flask import Blueprint, jsonify, request
import sqlite3
import json
import os

spatial_map_bp = Blueprint('spatial_map', __name__)

DB_PATH = os.path.join(os.path.dirname(__file__), 'database.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── GET /api/spatial-map ─────────────────────────────────────────────────────
# Semua titik deteksi sebagai GeoJSON, support filter
@spatial_map_bp.route('/api/spatial-map', methods=['GET'])
def get_spatial_map():
    location_filter   = request.args.get('location',   None)
    waste_type_filter = request.args.get('waste_type', None)
    date_from         = request.args.get('date_from',  None)
    date_to           = request.args.get('date_to',    None)

    conn = get_db()
    try:
        query = """
            SELECT id, location, latitude, longitude,
                   plastic_bag, bottle, wrapper, total_items,
                   confidence, result_path, created_at
            FROM detections
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        """
        params = []

        if location_filter:
            query += " AND location = ?"
            params.append(location_filter)
        if waste_type_filter:
            # map label ke kolom
            col_map = {
                'Kantong Plastik': 'plastic_bag',
                'Botol Plastik': 'bottle',
                'Kemasan/Wrapper': 'wrapper'
            }
            col = col_map.get(waste_type_filter)
            if col:
                query += f" AND {col} > 0"
        if date_from:
            query += " AND DATE(created_at) >= ?"
            params.append(date_from)
        if date_to:
            query += " AND DATE(created_at) <= ?"
            params.append(date_to)

        query += " ORDER BY created_at DESC"
        rows = conn.execute(query, params).fetchall()

        features = []
        for r in rows:
            # Tentukan jenis dominan
            breakdown = {
                'Kantong Plastik': r['plastic_bag'] or 0,
                'Botol Plastik':   r['bottle']      or 0,
                'Kemasan/Wrapper': r['wrapper']     or 0,
            }
            dominant = max(breakdown, key=breakdown.get)
            if breakdown[dominant] == 0:
                dominant = 'Tidak Terdeteksi'

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(r['longitude']), float(r['latitude'])]
                },
                "properties": {
                    "id":           r['id'],
                    "location":     r['location'],
                    "total_items":  r['total_items'] or 0,
                    "plastic_bag":  r['plastic_bag'] or 0,
                    "bottle":       r['bottle']      or 0,
                    "wrapper":      r['wrapper']     or 0,
                    "dominant":     dominant,
                    "confidence":   r['confidence']  or 0,
                    "result_path":  r['result_path'],
                    "created_at":   r['created_at'],
                }
            }
            features.append(feature)

        return jsonify({
            "success": True,
            "geojson": {"type": "FeatureCollection", "features": features},
            "total": len(features)
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


# ─── GET /api/spatial-map/layers ──────────────────────────────────────────────
# Data terpisah per kondisi: high / medium / low
@spatial_map_bp.route('/api/spatial-map/layers', methods=['GET'])
def get_layers():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT id, location, latitude, longitude,
                   plastic_bag, bottle, wrapper, total_items,
                   confidence, result_path, created_at,
                   CASE
                       WHEN total_items >= 10 THEN 'high'
                       WHEN total_items >= 4  THEN 'medium'
                       ELSE 'low'
                   END AS condition_level
            FROM detections
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            ORDER BY total_items DESC
        """).fetchall()

        layers = {"high": [], "medium": [], "low": []}
        for r in rows:
            breakdown = {
                'Kantong Plastik': r['plastic_bag'] or 0,
                'Botol Plastik':   r['bottle']      or 0,
                'Kemasan/Wrapper': r['wrapper']     or 0,
            }
            dominant = max(breakdown, key=breakdown.get)
            if breakdown[dominant] == 0:
                dominant = 'Tidak Terdeteksi'

            item = {
                "id":          r['id'],
                "location":    r['location'],
                "lat":         float(r['latitude']),
                "lon":         float(r['longitude']),
                "total_items": r['total_items'] or 0,
                "plastic_bag": r['plastic_bag'] or 0,
                "bottle":      r['bottle']      or 0,
                "wrapper":     r['wrapper']     or 0,
                "dominant":    dominant,
                "confidence":  r['confidence']  or 0,
                "result_path": r['result_path'],
                "created_at":  r['created_at'],
            }
            layers[r['condition_level']].append(item)

        return jsonify({
            "success": True,
            "layers": layers,
            "counts": {k: len(v) for k, v in layers.items()}
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


# ─── GET /api/spatial-map/summary ─────────────────────────────────────────────
# Statistik ringkasan: per lokasi, distribusi jenis, tren harian
@spatial_map_bp.route('/api/spatial-map/summary', methods=['GET'])
def get_summary():
    conn = get_db()
    try:
        loc_rows = conn.execute("""
            SELECT location,
                   AVG(latitude)     AS avg_lat,
                   AVG(longitude)    AS avg_lon,
                   SUM(total_items)  AS total_waste,
                   SUM(plastic_bag)  AS total_plastic_bag,
                   SUM(bottle)       AS total_bottle,
                   SUM(wrapper)      AS total_wrapper,
                   COUNT(*)          AS detection_count,
                   AVG(confidence)   AS avg_confidence,
                   MAX(created_at)   AS last_detected
            FROM detections
            WHERE latitude IS NOT NULL AND longitude IS NOT NULL
            GROUP BY location
        """).fetchall()

        daily_rows = conn.execute("""
            SELECT DATE(created_at)  AS date,
                   SUM(total_items)  AS total_waste,
                   COUNT(*)          AS detections
            FROM detections
            WHERE created_at >= DATE('now', '-14 days')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        """).fetchall()

        waste_dist = conn.execute("""
            SELECT SUM(plastic_bag) AS kantong_plastik,
                   SUM(bottle)      AS botol_plastik,
                   SUM(wrapper)     AS kemasan
            FROM detections
        """).fetchone()

        return jsonify({
            "success": True,
            "location_summary": [dict(r) for r in loc_rows],
            "daily_trend":       [dict(r) for r in daily_rows],
            "waste_distribution": {
                "Kantong Plastik": waste_dist['kantong_plastik'] or 0,
                "Botol Plastik":   waste_dist['botol_plastik']   or 0,
                "Kemasan/Wrapper": waste_dist['kemasan']          or 0,
            }
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()


# ─── GET /api/spatial-map/detail/<id> ─────────────────────────────────────────
@spatial_map_bp.route('/api/spatial-map/detail/<int:det_id>', methods=['GET'])
def get_detail(det_id):
    conn = get_db()
    try:
        r = conn.execute("SELECT * FROM detections WHERE id = ?", (det_id,)).fetchone()
        if not r:
            return jsonify({"success": False, "error": "Tidak ditemukan"}), 404
        return jsonify({"success": True, "data": dict(r)})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        conn.close()
