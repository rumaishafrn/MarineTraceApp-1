# MarineTrace - Plastic Pollution Tracker

Aplikasi untuk penelitian **ADDRESSING PLASTIC POLLUTION FROM SEAWEED FARMING IN SOUTH SULAWESI AND WEST SULAWESI**

## Fitur Utama

1. **Tracking Sampah** - Backtracking alur sampah dari lokasi Takalar dan Mamuju
2. **Deteksi Sampah** - Object detection + segmentation menggunakan YOLO model
3. **Database Akumulasi** - Menyimpan data deteksi untuk statistik akumulasi
4. **Support Model YOLO** - Detection & Segmentation models supported!

## ⚡ NEW: YOLO Segmentation Support!

Aplikasi ini mendukung **YOLO Segmentation models** yang memberikan:
- ✅ Bounding boxes (kotak deteksi)
- ✅ Segmentation masks (outline/mask objek)
- ✅ Visualisasi lebih detail dan akurat
- ✅ Analisis area dan bentuk sampah

**Lihat:** `SEGMENTATION_GUIDE.md` untuk panduan lengkap!

## Struktur Aplikasi

```
marine-trace-app/
├── backend/              # Flask API & YOLO inference
│   ├── app.py           # Main Flask application
│   ├── models/          # Folder untuk YOLO .pt model
│   ├── uploads/         # Uploaded images
│   ├── results/         # Detection results
│   └── database.db      # SQLite database
├── frontend/            # React application
│   ├── src/
│   ├── public/
│   └── package.json
└── README.md
```

## Instalasi

### 1. Backend Setup

```bash
cd backend

# Install dependencies
pip install flask flask-cors ultralytics opencv-python pillow numpy pandas --break-system-packages

# Jalankan server
python app.py
```

Server akan berjalan di `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Frontend akan berjalan di `http://localhost:5173`

## Cara Menggunakan Model YOLO Anda

1. **Copy model YOLO .pt Anda** ke folder `backend/models/`
2. **Update nama model** di `backend/app.py` (line ~20):
   ```python
   MODEL_PATH = 'models/your-model-name.pt'
   ```
3. Model akan otomatis load saat server dijalankan

## Cara Menambahkan Gambar Tracking

1. Siapkan gambar tracking untuk Takalar dan Mamuju
2. Rename menjadi:
   - `takalar_tracking.png`
   - `mamuju_tracking.png`
3. Copy ke folder `frontend/public/tracking/`

## Cara Menambahkan Contoh Gambar Detection

1. Copy gambar hasil detection YOLO ke `frontend/public/examples/`
2. Gunakan sebagai referensi UI

## Database

Database SQLite otomatis dibuat dengan tabel:
- `detections` - Menyimpan semua deteksi sampah
- `accumulations` - Statistik akumulasi per lokasi

## Deploy ke GitHub

```bash
git init
git add .
git commit -m "Initial commit - MarineTrace App"
git branch -M main
git remote add origin https://github.com/username/marine-trace.git
git push -u origin main
```

## Deploy Online (Production)

### Backend Options:
- **Heroku** (gratis untuk demo)
- **Railway** (mudah, support Python)
- **Google Cloud Run**
- **DigitalOcean**

### Frontend Options:
- **Vercel** (recommended, gratis)
- **Netlify**
- **GitHub Pages**

## API Endpoints

### POST /api/track
Tracking sampah berdasarkan lokasi dan waktu
```json
{
  "location": "Takalar",
  "latitude": -5.123,
  "longitude": 119.456,
  "start_date": "2024-02-01",
  "days": 7
}
```

### POST /api/detect
Deteksi sampah dari gambar
```json
{
  "location": "Takalar",
  "image": "base64_image_string"
}
```

### GET /api/stats/{location}
Dapatkan statistik akumulasi untuk lokasi tertentu

## Teknologi

- **Frontend**: React 18 + Vite + TailwindCSS
- **Backend**: Flask + Python 3.10+
- **ML Model**: YOLOv8 (Ultralytics)
- **Database**: SQLite
- **Image Processing**: OpenCV, Pillow

## Lisensi

Untuk penelitian akademik PAIR
