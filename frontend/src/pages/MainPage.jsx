import React from 'react'
import './MainPage.css'

function MainPage({ onNavigate }) {
  return (
    <div className="main-page fade-in">
      <div className="container">
        <div className="main-header">
          <div className="logo">🌊</div>
          <h1>MarineTrace</h1>
          <p className="subtitle">
            Sistem Monitoring dan Deteksi Polusi Plastik dari Budidaya Rumput Laut
            di Sulawesi Selatan dan Sulawesi Barat
          </p>
          <p className="subtitle-small">
            Addressing Plastic Pollution from Seaweed Farming in South Sulawesi and West Sulawesi
          </p>
        </div>

        <div className="section-cards">
          {/* Card 1: Tracking */}
          <div className="card" onClick={() => onNavigate('tracking')}>
            <div className="card-icon">📍</div>
            <h2>Tracking Sampah</h2>
            <p>
              Lacak pergerakan sampah plastik dari lokasi Takalar dan Mamuju
              menggunakan model backtracking berbasis data oceanografi
            </p>
            <button className="btn">Mulai Tracking</button>
          </div>

          {/* Card 2: Deteksi */}
          <div className="card" onClick={() => onNavigate('detection')}>
            <div className="card-icon">🔍</div>
            <h2>Deteksi Sampah</h2>
            <p>
              Deteksi dan identifikasi jenis sampah plastik menggunakan
              teknologi AI Computer Vision (YOLO Object Detection)
            </p>
            <button className="btn">Mulai Deteksi</button>
          </div>

          {/* Card 3: Spatial Map — BARU */}
          <div className="card card-featured" onClick={() => onNavigate('spatial-map')}>
            <div className="card-icon">🗺️</div>
            <h2>Spatial Mapping</h2>
            <p>
              Lihat persebaran sampah secara spasial pada peta interaktif.
              Data dari hasil deteksi ditampilkan berdasarkan koordinat & kondisi.
            </p>
            <button className="btn btn-map">Buka Peta</button>
          </div>
        </div>

        <div className="info-section">
          <h3>Tentang Penelitian</h3>
          <p>
            Penelitian ini bertujuan untuk mengidentifikasi, melacak, dan menganalisis
            polusi plastik yang berasal dari aktivitas budidaya rumput laut di wilayah
            Sulawesi Selatan (Takalar) dan Sulawesi Barat (Mamuju). Dengan menggunakan
            teknologi AI dan data oceanografi, kami dapat memahami pola penyebaran
            sampah dan mengembangkan strategi mitigasi yang efektif.
          </p>
        </div>
      </div>
    </div>
  )
}

export default MainPage
