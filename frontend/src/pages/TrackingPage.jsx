import React, { useState } from 'react'
import axios from 'axios'
import './TrackingPage.css'

function TrackingPage({ onBack }) {
  const [formData, setFormData] = useState({
    location: '',
    latitude: '',
    longitude: '',
    start_date: new Date().toISOString().split('T')[0],
    days: '',
    particles: 100
  })

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleLocationChange = (e) => {
    const location = e.target.value
    setFormData(prev => ({
      ...prev,
      location,
      // Set default coordinates based on location
      latitude: location === 'Takalar' ? '-5.59581' : location === 'Mamuju' ? '-2.65112' : '',
      longitude: location === 'Takalar' ? '119.4815' : location === 'Mamuju' ? '118.92987' : ''
    }))
  }

  const startTracking = async () => {
    // Validation
    if (!formData.latitude || !formData.longitude || !formData.days) {
      alert('Mohon lengkapi semua field!')
      return
    }

    const lat = parseFloat(formData.latitude)
    const lon = parseFloat(formData.longitude)
    const days = parseInt(formData.days)
    const particles = parseInt(formData.particles)

    if (lat < -90 || lat > 90) {
      alert('Latitude harus antara -90 dan 90')
      return
    }
    if (lon < -180 || lon > 180) {
      alert('Longitude harus antara -180 dan 180')
      return
    }
    if (days < 1 || days > 30) {
      alert('Durasi harus antara 1 dan 30 hari')
      return
    }
    if (particles < 1 || particles > 5000) {
      alert('Jumlah partikel harus antara 1 dan 5000')
      return
    }

    setLoading(true)
    setProgress(0)
    setError(null)
    setStatusMessage('Mengirim permintaan simulasi...')
    setResults(null)

    try {
      // 1. Start Simulation
      const payload = {
        lat: parseFloat(formData.latitude),
        lon: parseFloat(formData.longitude),
        start_time: formData.start_date,
        days: parseInt(formData.days),
        particles: parseInt(formData.particles)
      }

      const response = await axios.post('http://localhost:5000/api/simulate', payload)
      const jobId = response.data.job_id
      
      setStatusMessage('Simulasi sedang berjalan di server...')
      
      // 2. Poll for Status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`http://localhost:5000/api/simulate/${jobId}`)
          const job = statusRes.data
          
          if (job.status === 'completed') {
            clearInterval(pollInterval)
            setResults(job)
            setLoading(false)
            setStatusMessage('Selesai!')
          } else if (job.status === 'failed') {
            clearInterval(pollInterval)
            setLoading(false)
            setError(job.error || 'Simulasi gagal.')
          } else {
            // Still running
            setStatusMessage('Sedang memproses... (estimasi 1-2 menit)')
          }
        } catch (err) {
          console.error("Polling error", err)
        }
      }, 2000) // Poll every 2 seconds

    } catch (err) {
      setLoading(false)
      const errorMsg = err.response?.data?.error || err.message || 'Terjadi kesalahan saat tracking'
      setError(errorMsg)
      console.error('Tracking error:', err)
    }
  }

  const resetTracking = () => {
    setResults(null)
    setProgress(0)
    setError(null)
    setFormData({
      location: '',
      latitude: '',
      longitude: '',
      start_date: new Date().toISOString().split('T')[0],
      days: ''
    })
  }

  const formatDate = (dateString) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const date = new Date(dateString)
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`
  }

  return (
    <div className="tracking-page slide-in">
      <div className="container">
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          ← Kembali ke Beranda
        </button>

        <div className="content-box">
          <h1>🌊 Tracking Sampah Plastik</h1>
          <p className="description">
            Masukkan data lokasi dan periode waktu untuk melacak pergerakan sampah plastik
          </p>

          {!results ? (
            <div className="tracking-form">
              <div className="form-group">
                <label>Lokasi Penelitian</label>
                <select
                  name="location"
                  value={formData.location}
                  onChange={handleLocationChange}
                >
                  <option value="">Pilih Lokasi</option>
                  <option value="Takalar">Takalar, Sulawesi Selatan</option>
                  <option value="Mamuju">Mamuju, Sulawesi Barat</option>
                </select>
              </div>

              <div className="input-row">
                <div className="form-group">
                  <label>Latitude</label>
                  <input
                    type="number"
                    name="latitude"
                    step="0.0001"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    placeholder="Contoh: -5.3971"
                  />
                </div>
                <div className="form-group">
                  <label>Longitude</label>
                  <input
                    type="number"
                    name="longitude"
                    step="0.0001"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    placeholder="Contoh: 119.4419"
                  />
                </div>
              </div>

              <div className="input-row">
                <div className="form-group">
                  <label>Tanggal Mulai Tracking</label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Durasi Tracking (Hari)</label>
                  <input
                    type="number"
                    name="days"
                    min="1"
                    max="30"
                    value={formData.days}
                    onChange={handleInputChange}
                    placeholder="Contoh: 7"
                  />
                </div>
                <div className="form-group">
                  <label>Jumlah Partikel</label>
                  <input
                    type="number"
                    name="particles"
                    min="10"
                    max="1000"
                    value={formData.particles}
                    onChange={handleInputChange}
                    placeholder="Contoh: 100"
                  />
                </div>
              </div>

              {error && (
                <div className="error-message">
                  ⚠️ {error}
                </div>
              )}

              <button className="btn btn-primary" onClick={startTracking}>
                🚀 Mulai Tracking
              </button>
            </div>
          ) : (
            <div className="tracking-results">
              <h2>📊 Hasil Simulasi Tracking</h2>

              <div className="info-grid">
                <div className="info-card">
                  <h3>Koordinat Awal</h3>
                  <p>{results.params?.lat || formData.latitude}, {results.params?.lon || formData.longitude}</p>
                </div>
                <div className="info-card">
                  <h3>Waktu Mulai</h3>
                  <p>{results.params?.start_time || formData.start_date}</p>
                </div>
                <div className="info-card">
                  <h3>Durasi</h3>
                  <p>{results.params?.days || formData.days} Hari</p>
                </div>
                <div className="info-card">
                  <h3>Partikel</h3>
                  <p>{results.params?.particles || 100}</p>
                </div>
              </div>

              <div className="map-container">
                <h3>Hasil Simulasi (Backtracking)</h3>
                
                {/* 1. Animation */}
                {(results.files?.animation) ? (
                  <div className="plots-grid">
                    <div className="image-container">
                      <img 
                        src={`http://localhost:5000${results.files.animation}`} 
                        alt="Drift Animation" 
                        style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd'}}
                      />
                    </div>
                  </div>
                ) : (
                  <p>Animasi tidak tersedia. (Cek log server untuk detail error)</p>
                )}

                {/* 2. Statistics */}
                <div className="info-grid" style={{marginTop: '20px', marginBottom: '20px'}}>
                  <div className="info-card">
                    <h3>Jarak Rata-rata</h3>
                    <p>{results.stats?.mean_distance_km ? `${results.stats.mean_distance_km.toFixed(2)} km` : '-'}</p>
                  </div>
                  <div className="info-card">
                    <h3>Kecepatan Rata-rata</h3>
                    <p>{results.stats?.mean_speed_ms ? `${results.stats.mean_speed_ms.toFixed(4)} m/s` : '-'}</p>
                  </div>
                  <div className="info-card">
                    <h3>Arah Dominan</h3>
                    <p>{results.stats?.dominant_direction || '-'}</p>
                  </div>
                </div>

                {/* 3. OSM Plot */}
                {results.files?.osm_plot && (
                  <div className="plots-grid">
                    <div className="image-container">
                      <img 
                        src={`http://localhost:5000${results.files.osm_plot}`} 
                        alt="OSM Plot" 
                        style={{maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd'}}
                      />
                    </div>
                  </div>
                )}
              </div>

              

              <div className="button-group">
                <button className="btn btn-secondary" onClick={resetTracking}>
                  🔄 Simulasi Baru
                </button>
                <button className="btn btn-secondary" onClick={onBack}>
                  🏠 Kembali ke Beranda
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-content">
            <div className="spinner"></div>
            <h2>Memproses Tracking...</h2>
            <p>{statusMessage || 'Menganalisis data oceanografi dan pola arus...'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrackingPage
