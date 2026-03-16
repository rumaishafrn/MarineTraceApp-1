<div align="center">

# 🌊 MarineTrace

### Sistem Monitoring & Deteksi Polusi Plastik dari Budidaya Rumput Laut
### *Addressing Plastic Pollution from Seaweed Farming in South Sulawesi and West Sulawesi*

<br/>

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=for-the-badge&logo=flask&logoColor=white)
![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-FF6B35?style=for-the-badge)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

<br/>

> Aplikasi web berbasis AI untuk memantau, mendeteksi, dan memetakan persebaran sampah plastik di kawasan budidaya rumput laut wilayah **Takalar, Sulawesi Selatan** dan **Mamuju, Sulawesi Barat** — bagian dari penelitian **SINERGI**.

</div>

---

## 📌 Tentang Proyek

Polusi plastik dari aktivitas budidaya rumput laut merupakan permasalahan lingkungan yang serius di perairan Sulawesi. Proyek **MarineTrace** hadir sebagai solusi berbasis teknologi untuk:

- **Melacak** pergerakan dan asal-usul sampah plastik menggunakan simulasi arus laut
- **Mendeteksi** jenis sampah secara otomatis dari foto lapangan menggunakan model AI
- **Memetakan** persebaran sampah secara spasial untuk mendukung pengambilan keputusan berbasis data

---

## ✨ Fitur Utama

### 1. 📍 Tracking Sampah — *Backtracking Simulasi Arus Laut*

Fitur ini memungkinkan pengguna untuk melacak **dari mana asal sampah** menggunakan simulasi partikel berbasis data oceanografi.

- Input koordinat titik temuan sampah dan tanggal penemuan
- Sistem menjalankan **simulasi backtracking** arus laut secara mundur
- Output berupa **animasi lintasan partikel** dan peta sebaran asal sampah
- Mendukung konfigurasi jumlah partikel dan durasi simulasi (1–30 hari)
- Menampilkan statistik: jarak rata-rata, kecepatan arus, dan arah dominan

```
Input  : Koordinat (lat, lon) + Tanggal + Durasi
Output : Animasi lintasan · Peta OSM · Statistik arus
```

---

### 2. 🔍 Deteksi Sampah — *AI Object Detection (YOLO)*

Fitur deteksi sampah menggunakan model **YOLOv8** yang telah dilatih khusus untuk mengenali jenis-jenis sampah plastik dari foto lapangan.

- **Upload banyak gambar sekaligus** (batch detection) — pilih puluhan foto langsung dari galeri
- Mendukung **drag & drop** file ke area upload
- Setiap gambar diproses satu per satu dengan progress bar real-time
- Deteksi mencakup: kantong plastik, botol plastik, kemasan/wrapper
- Hasil menampilkan **perbandingan gambar original vs hasil anotasi YOLO**
- Input **koordinat GPS** — bisa diisi manual atau otomatis via browser GPS
- Data tersimpan ke database dan terintegrasi langsung ke Spatial Map
- Menampilkan **akumulasi statistik** per lokasi dari seluruh sesi deteksi

```
Input  : Foto sampah + Lokasi + Koordinat GPS
Output : Bounding box · Jumlah item · Jenis dominan · Akurasi · Akumulasi data
```

---

### 3. 🗺️ Spatial Mapping — *Peta Persebaran Sampah Interaktif*

Fitur pemetaan spasial menampilkan **semua data deteksi** dalam bentuk peta interaktif berbasis OpenStreetMap, sehingga persebaran sampah dapat divisualisasikan secara geografis.

- Peta interaktif dengan **marker berwarna** berdasarkan tingkat kondisi pencemaran
- **3 layer kondisi** yang dapat ditampilkan/disembunyikan secara independen:

  | Layer | Warna | Kondisi | Jumlah Item Terdeteksi |
  |-------|-------|---------|------------------------|
  | Kritis | 🔴 Merah | Tinggi | ≥ 10 item |
  | Waspada | 🟠 Oranye | Sedang | 4–9 item |
  | Aman | 🟢 Hijau | Rendah | 1–3 item |

- Klik marker → popup detail: foto hasil deteksi, jenis sampah, jumlah, akurasi, koordinat
- **Filter** berdasarkan lokasi dan jenis sampah
- **Auto-scatter koordinat** — upload 100 foto dari lokasi yang sama tetap menghasilkan titik-titik yang menyebar natural di sekitar area (radius ±1 km, distribusi Gaussian), bukan tumpuk di satu titik
- **Tab Statistik** meliputi:
  - Bar chart akumulasi sampah per lokasi
  - Distribusi jenis sampah (kantong plastik / botol / kemasan)
  - Grafik tren deteksi 14 hari terakhir
  - Ringkasan jumlah titik per kondisi layer

```
Input  : Data dari database deteksi (otomatis)
Output : Peta interaktif · Layer kondisi · Statistik · Tren harian
```

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                    │
│  MainPage  │  TrackingPage  │  DetectionPage  │  SpatialMapPage  │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / REST API
┌────────────────────────▼────────────────────────────────┐
│                    BACKEND (Flask)                      │
│   /api/simulate   │   /api/detect   │   /api/spatial-map│
└──────┬────────────────────┬──────────────────┬──────────┘
       │                    │                  │
  Simulation           YOLO Model          SQLite DB
  (Oceanography        (best.pt)         (detections +
   + Parcels)                            accumulations)
```

---

## 📁 Struktur Direktori

```
MarineTraceApp/
├── backend/
│   ├── app.py                  ← Server Flask utama + koordinat scatter
│   ├── spatial_map.py          ← Blueprint API spatial mapping
│   ├── requirements.txt
│   ├── models/
│   │   └── best.pt             ← Model YOLO (tidak disertakan di repo)
│   ├── simulation/             ← Modul simulasi arus laut
│   ├── uploads/                ← Gambar upload (auto-generated)
│   ├── results/                ← Hasil deteksi YOLO (auto-generated)
│   └── database.db             ← SQLite database (auto-generated)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── App.jsx             ← Root + routing
        ├── App.css
        ├── index.css
        ├── main.jsx
        └── pages/
            ├── MainPage.jsx        ← Beranda (3 fitur card)
            ├── MainPage.css
            ├── TrackingPage.jsx    ← Halaman backtracking
            ├── TrackingPage.css
            ├── DetectionPage.jsx   ← Halaman deteksi (multi-upload)
            ├── DetectionPage.css
            ├── SpatialMapPage.jsx  ← Peta spasial interaktif
            └── SpatialMapPage.css
```

---

## 🚀 Instalasi & Menjalankan

### Prasyarat

- Python 3.10+
- Node.js 18+
- Model YOLO `.pt` yang telah dilatih

### 1. Clone Repository

```bash
git clone https://github.com/rumaishafrn/MarineTraceApp.git
cd MarineTraceApp
```

### 2. Setup Backend

```bash
cd backend

# Install dependencies Python
pip install -r requirements.txt

# Taruh model YOLO ke folder models/
# cp /path/to/your/model.pt models/best.pt

# Jalankan server
python app.py
```

Server berjalan di → **http://localhost:5000**

> Database SQLite akan otomatis dibuat beserta semua tabel yang diperlukan saat pertama kali dijalankan.

### 3. Setup Frontend

```bash
cd frontend

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Frontend berjalan di → **http://localhost:5173**

---

## 🔌 API Endpoints

### Tracking & Detection

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/health` | Cek status server & model YOLO |
| `POST` | `/api/simulate` | Mulai simulasi backtracking (async) |
| `GET` | `/api/simulate/<job_id>` | Polling status simulasi |
| `POST` | `/api/detect` | Deteksi sampah dari gambar |

### Spatial Map

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/spatial-map` | Semua deteksi sebagai GeoJSON |
| `GET` | `/api/spatial-map/layers` | Data terpisah per layer kondisi |
| `GET` | `/api/spatial-map/summary` | Statistik lokasi, jenis, tren harian |
| `GET` | `/api/spatial-map/detail/<id>` | Detail satu titik deteksi |

**Query params tersedia untuk `/api/spatial-map`:**
```
?location=Takalar
?waste_type=Kantong+Plastik
?date_from=2024-01-01&date_to=2024-12-31
```

---

## 🛠️ Teknologi yang Digunakan

| Komponen | Teknologi |
|----------|-----------|
| Frontend Framework | React 18 + Vite |
| Styling | CSS (custom, tanpa framework) |
| Peta Interaktif | Leaflet.js (via CDN) |
| Backend Framework | Flask + Flask-CORS |
| Machine Learning | YOLOv8 (Ultralytics) |
| Image Processing | OpenCV, Pillow |
| Database | SQLite |
| Simulasi Arus | OceanParcels / Custom Simulation |
| Scheduler | APScheduler |

---

## 📊 Alur Penggunaan

```
1. Buka aplikasi di http://localhost:5173

2. TRACKING
   Pilih lokasi → isi koordinat & tanggal → klik "Mulai Tracking"
   → Tunggu simulasi selesai → lihat animasi lintasan & statistik

3. DETEKSI
   Pilih lokasi → isi/ambil koordinat GPS → upload foto (bisa banyak)
   → klik "Deteksi Semua" → lihat hasil per gambar + akumulasi

4. SPATIAL MAP
   Data dari deteksi otomatis muncul di peta
   → Filter lokasi/jenis → toggle layer kondisi → klik marker untuk detail
   → Tab Statistik untuk analisis lebih lanjut
```

---

## 🔬 Tentang Penelitian

Proyek ini dikembangkan sebagai bagian dari penelitian:

> **"Addressing Plastic Pollution from Seaweed Farming in South Sulawesi and West Sulawesi"**
> Program Penelitian PAIR

Wilayah kajian meliputi:
- **Takalar, Sulawesi Selatan** — salah satu sentra budidaya rumput laut terbesar di Indonesia
- **Mamuju, Sulawesi Barat** — kawasan budidaya rumput laut dengan potensi pencemaran plastik tinggi

---

## 📄 Lisensi

Proyek ini dikembangkan untuk keperluan penelitian akademik. Untuk penggunaan lebih lanjut silakan hubungi tim peneliti.

---

<div align="center">
  <sub>Dikembangkan untuk penelitian SINERGI · Polusi Plastik Budidaya Rumput Laut Sulawesi</sub>
</div>
