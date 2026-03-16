import React, { useState, useRef } from 'react'
import axios from 'axios'
import './DetectionPage.css'

// Status tiap gambar: 'waiting' | 'processing' | 'done' | 'error'

function DetectionPage({ onBack }) {
  const [location,    setLocation]    = useState('')
  const [latitude,    setLatitude]    = useState('')
  const [longitude,   setLongitude]   = useState('')
  const [usingGPS,    setUsingGPS]    = useState(false)
  const [imageQueue,  setImageQueue]  = useState([])   // [{id, file, name, preview, status, result, error}]
  const [isRunning,   setIsRunning]   = useState(false)
  const [currentIdx,  setCurrentIdx]  = useState(null)
  const [isDragOver,  setIsDragOver]  = useState(false)
  const [batchDone,   setBatchDone]   = useState(false)
  const [expandedIdx, setExpandedIdx] = useState(null)
  const fileInputRef = useRef(null)

  // ── Koordinat default per lokasi ─────────────────────────────────────────
  const handleLocationChange = (e) => {
    const loc = e.target.value
    setLocation(loc)
    if (loc === 'Takalar')      { setLatitude('-5.59581');  setLongitude('119.4815') }
    else if (loc === 'Mamuju')  { setLatitude('-2.65112');  setLongitude('118.92987') }
    else                        { setLatitude('');          setLongitude('') }
  }

  // ── GPS otomatis ──────────────────────────────────────────────────────────
  const getGPSLocation = () => {
    if (!navigator.geolocation) { alert('Browser tidak mendukung GPS'); return }
    setUsingGPS(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6))
        setLongitude(pos.coords.longitude.toFixed(6))
        setUsingGPS(false)
      },
      (err) => { alert('Gagal GPS: ' + err.message); setUsingGPS(false) }
    )
  }

  // ── Buat item antrian dari File ───────────────────────────────────────────
  const makeQueueItem = (file) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve({
      id:      Math.random().toString(36).slice(2),
      file,
      name:    file.name,
      preview: e.target.result,
      status:  'waiting',
      result:  null,
      error:   null,
    })
    reader.readAsDataURL(file)
  })

  // ── Tambah file ke antrian ────────────────────────────────────────────────
  const addFiles = async (files) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!valid.length) return
    const items = await Promise.all(valid.map(makeQueueItem))
    setImageQueue(prev => [...prev, ...items])
    setBatchDone(false)
  }

  const handleFileInput  = (e) => addFiles(e.target.files)
  const handleDrop       = (e) => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files) }
  const handleDragOver   = (e) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave  = ()  => setIsDragOver(false)

  const removeImage = (id) => setImageQueue(prev => prev.filter(i => i.id !== id))

  const updateItem = (id, patch) =>
    setImageQueue(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))

  // ── Deteksi satu gambar ───────────────────────────────────────────────────
  const detectOne = async (item) => {
    try {
      const res = await axios.post('/api/detect', {
        location,
        image:     item.preview,
        latitude:  latitude  ? parseFloat(latitude)  : null,
        longitude: longitude ? parseFloat(longitude) : null,
      })
      return { status: 'done', result: res.data.data }
    } catch (err) {
      return { status: 'error', error: err.response?.data?.error || err.response?.data?.message || 'Gagal mendeteksi' }
    }
  }

  // ── Jalankan batch secara sekuensial ──────────────────────────────────────
  const startBatchDetection = async () => {
    if (!location)            { alert('Mohon pilih lokasi terlebih dahulu!'); return }
    if (!imageQueue.length)   { alert('Mohon upload minimal 1 gambar!');      return }

    setIsRunning(true)
    setBatchDone(false)

    // Ambil snapshot terbaru antrian
    const snapshot = imageQueue.map((i, idx) => ({ ...i, _idx: idx }))

    for (let i = 0; i < snapshot.length; i++) {
      const item = snapshot[i]
      if (item.status === 'done') continue

      setCurrentIdx(i)
      updateItem(item.id, { status: 'processing' })

      const patch = await detectOne(item)
      updateItem(item.id, patch)
      snapshot[i] = { ...item, ...patch }
    }

    setCurrentIdx(null)
    setIsRunning(false)
    setBatchDone(true)

    // Auto-expand hasil pertama
    const first = snapshot.findIndex(i => i.status === 'done')
    if (first !== -1) setExpandedIdx(first)
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetAll = () => {
    setImageQueue([])
    setLocation('')
    setLatitude('')
    setLongitude('')
    setIsRunning(false)
    setCurrentIdx(null)
    setBatchDone(false)
    setExpandedIdx(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Statistik ringkasan ───────────────────────────────────────────────────
  const doneItems    = imageQueue.filter(i => i.status === 'done')
  const errorItems   = imageQueue.filter(i => i.status === 'error')
  const totalDetect  = doneItems.reduce((s, i) => s + (i.result?.total_detected  || 0), 0)
  const totalPlastic = doneItems.reduce((s, i) => s + (i.result?.breakdown?.plastic_bag || 0), 0)
  const totalBottle  = doneItems.reduce((s, i) => s + (i.result?.breakdown?.bottle      || 0), 0)
  const totalWrapper = doneItems.reduce((s, i) => s + (i.result?.breakdown?.wrapper     || 0), 0)
  const doneCount    = imageQueue.filter(i => i.status === 'done' || i.status === 'error').length
  const progressPct  = imageQueue.length > 0 ? Math.round((doneCount / imageQueue.length) * 100) : 0

  const statusBadge = (item) => {
    if (item.status === 'waiting')    return <span className="badge badge-wait">⏳ Menunggu</span>
    if (item.status === 'processing') return <span className="badge badge-proc">🔄 Memproses...</span>
    if (item.status === 'done')       return <span className="badge badge-done">✅ {item.result?.total_detected} item</span>
    if (item.status === 'error')      return <span className="badge badge-err">❌ Error</span>
  }

  return (
    <div className="detection-page slide-in">
      <div className="container">
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          ← Kembali ke Beranda
        </button>

        {/* ════ FORM ══════════════════════════════════════════════════════ */}
        <div className="content-box">
          <h1>🔍 Deteksi Sampah Plastik</h1>
          <p className="description">
            Upload banyak foto sekaligus — semua akan dideteksi otomatis satu per satu
          </p>

          <div className="detection-form">

            {/* Lokasi */}
            <div className="form-group">
              <label>Lokasi Sampah</label>
              <select value={location} onChange={handleLocationChange} disabled={isRunning}>
                <option value="">Pilih Lokasi</option>
                <option value="Takalar">Takalar, Sulawesi Selatan</option>
                <option value="Mamuju">Mamuju, Sulawesi Barat</option>
              </select>
            </div>

            {/* Koordinat */}
            <div className="form-group">
              <label>📍 Koordinat GPS <span className="label-hint">(untuk spatial map)</span></label>
              <div className="coord-row">
                <input type="number" step="any" placeholder="Latitude (contoh: -5.59581)"
                  value={latitude} onChange={e => setLatitude(e.target.value)} disabled={isRunning} />
                <input type="number" step="any" placeholder="Longitude (contoh: 119.4815)"
                  value={longitude} onChange={e => setLongitude(e.target.value)} disabled={isRunning} />
              </div>
              <button type="button" className="btn-gps" onClick={getGPSLocation}
                disabled={usingGPS || isRunning}>
                {usingGPS ? '🔄 Mengambil GPS...' : '📡 Gunakan Lokasi GPS Saya'}
              </button>
              {latitude && longitude && (
                <p className="coord-preview">✅ {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}</p>
              )}
            </div>

            {/* Upload area multi */}
            <div className="form-group">
              <div className="upload-header">
                <label>Upload Gambar Sampah</label>
                {imageQueue.length > 0 && (
                  <span className="upload-count">{imageQueue.length} foto dipilih</span>
                )}
              </div>

              <div
                className={`upload-area multi ${isDragOver ? 'drag-over' : ''}`}
                onClick={() => !isRunning && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                {imageQueue.length === 0 ? (
                  <div className="upload-placeholder">
                    <div className="upload-icon">📂</div>
                    <p className="upload-main">Klik atau drag &amp; drop gambar ke sini</p>
                    <p className="upload-hint">Pilih banyak file sekaligus · JPG, PNG (Max 10MB/file)</p>
                  </div>
                ) : (
                  <div className="preview-grid">
                    {imageQueue.map((item, idx) => (
                      <div key={item.id} className={`preview-card status-${item.status}`}>
                        <img src={item.preview} alt={item.name} className="preview-thumb" />
                        <div className="preview-info">
                          <p className="preview-name" title={item.name}>{item.name}</p>
                          {statusBadge(item)}
                        </div>
                        {!isRunning && item.status !== 'processing' && (
                          <button
                            className="remove-btn"
                            onClick={(e) => { e.stopPropagation(); removeImage(item.id) }}
                          >✕</button>
                        )}
                        {item.status === 'processing' && (
                          <div className="processing-overlay">
                            <div className="spinner-sm" />
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Tombol tambah lebih banyak */}
                    {!isRunning && (
                      <div
                        className="preview-card add-more"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                      >
                        <span className="add-icon">＋</span>
                        <p>Tambah Foto</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </div>

            {/* Progress bar saat berjalan */}
            {isRunning && (
              <div className="batch-progress">
                <div className="batch-progress-header">
                  <span>🔄 Memproses {doneCount} / {imageQueue.length} gambar</span>
                  <span className="batch-pct">{progressPct}%</span>
                </div>
                <div className="progress-container">
                  <div className="progress-bar animated" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            {/* Tombol aksi */}
            <div className="action-row">
              <button
                className="btn btn-primary"
                onClick={startBatchDetection}
                disabled={isRunning || !location || imageQueue.length === 0}
              >
                {isRunning
                  ? `🔄 Mendeteksi ${currentIdx !== null ? currentIdx + 1 : ''}/${imageQueue.length}...`
                  : `🚀 Deteksi ${imageQueue.length > 1 ? `${imageQueue.length} Gambar` : 'Gambar'}`
                }
              </button>
              {imageQueue.length > 0 && !isRunning && (
                <button className="btn btn-secondary" onClick={resetAll}>🗑️ Hapus Semua</button>
              )}
            </div>

          </div>
        </div>

        {/* ════ HASIL BATCH ════════════════════════════════════════════════ */}
        {batchDone && doneItems.length > 0 && (
          <div className="content-box results-box">
            <h2>✅ Hasil Deteksi Batch — {doneItems.length} Gambar Berhasil</h2>

            {errorItems.length > 0 && (
              <div className="error-message">
                ⚠️ {errorItems.length} gambar gagal dideteksi.
              </div>
            )}

            {/* Ringkasan total */}
            <div className="info-grid">
              <div className="info-card"><h3>Gambar Berhasil</h3><p>{doneItems.length}</p></div>
              <div className="info-card"><h3>Total Sampah</h3><p>{totalDetect} item</p></div>
              <div className="info-card"><h3>🛍️ Kantong</h3><p>{totalPlastic} item</p></div>
              <div className="info-card"><h3>🍼 Botol</h3><p>{totalBottle} item</p></div>
              <div className="info-card"><h3>📦 Kemasan</h3><p>{totalWrapper} item</p></div>
              <div className="info-card">
                <h3>📍 Koordinat</h3>
                <p style={{ fontSize: '0.82em' }}>
                  {latitude && longitude
                    ? `${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)}`
                    : '—'}
                </p>
              </div>
            </div>

            {latitude && longitude && (
              <div className="coord-saved">
                📍 Semua <b>{doneItems.length}</b> deteksi tersimpan dengan koordinat{' '}
                <b>{parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}</b>
                {' '}— akan muncul di <b>Spatial Map</b>
              </div>
            )}

            {/* Accordion per gambar */}
            <h3 className="detail-heading">Detail per Gambar</h3>
            <div className="results-accordion">
              {imageQueue.map((item, idx) => (
                <div key={item.id} className={`accordion-item status-${item.status}`}>
                  {/* Header */}
                  <div
                    className="accordion-header"
                    onClick={() => item.status === 'done' && setExpandedIdx(expandedIdx === idx ? null : idx)}
                  >
                    <div className="accordion-left">
                      <img src={item.preview} alt="" className="accordion-thumb" />
                      <div>
                        <p className="accordion-name">{item.name}</p>
                        {item.status === 'done' && (
                          <p className="accordion-sub">
                            {item.result.total_detected} item · akurasi {item.result.confidence}%
                          </p>
                        )}
                        {item.status === 'error' && (
                          <p className="accordion-sub error-text">❌ {item.error}</p>
                        )}
                      </div>
                    </div>
                    <div className="accordion-right">
                      {statusBadge(item)}
                      {item.status === 'done' && (
                        <span className="accordion-chevron">{expandedIdx === idx ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  {expandedIdx === idx && item.status === 'done' && (
                    <div className="accordion-body">
                      <div className="image-comparison">
                        <div className="comparison-item">
                          <h4>Gambar Original</h4>
                          <div className="image-container">
                            <img src={item.preview} alt="Original" />
                          </div>
                        </div>
                        <div className="comparison-item">
                          <h4>Hasil Deteksi YOLO</h4>
                          <div className="image-container">
                            <img src={item.result.result_image} alt="Deteksi" />
                          </div>
                        </div>
                      </div>

                      <div className="stats-container">
                        <h3>📊 Breakdown</h3>
                        <div className="stats-grid">
                          <div className="stats-item">
                            <span className="stats-label">🛍️ Kantong Plastik</span>
                            <span className="stats-value">{item.result.breakdown.plastic_bag} item</span>
                          </div>
                          <div className="stats-item">
                            <span className="stats-label">🍼 Botol Plastik</span>
                            <span className="stats-value">{item.result.breakdown.bottle} item</span>
                          </div>
                          <div className="stats-item">
                            <span className="stats-label">📦 Kemasan/Wrapper</span>
                            <span className="stats-value">{item.result.breakdown.wrapper} item</span>
                          </div>
                          <div className="stats-item">
                            <span className="stats-label">🎯 Dominan</span>
                            <span className="stats-value">
                              {item.result.dominant.name} ({item.result.dominant.percentage}%)
                            </span>
                          </div>
                          <div className="stats-item">
                            <span className="stats-label">🎯 Akurasi Model</span>
                            <span className="stats-value">{item.result.confidence}%</span>
                          </div>
                        </div>
                      </div>

                      {item.result.all_detections && Object.keys(item.result.all_detections).length > 0 && (
                        <div className="stats-container">
                          <h3>🔬 Semua Class Terdeteksi</h3>
                          <div className="stats-grid">
                            {Object.entries(item.result.all_detections).map(([cls, cnt]) => (
                              <div className="stats-item" key={cls}>
                                <span className="stats-label">{cls}</span>
                                <span className="stats-value">{cnt} item</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.result.accumulation && (
                        <div className="stats-container highlight">
                          <h3>📈 Akumulasi {item.result.location}</h3>
                          <div className="stats-grid">
                            <div className="stats-item">
                              <span className="stats-label">Total Akumulasi Sampah</span>
                              <span className="stats-value">{item.result.accumulation.total} item</span>
                            </div>
                            <div className="stats-item">
                              <span className="stats-label">Kantong Plastik</span>
                              <span className="stats-value">{item.result.accumulation.plastic_bag} item</span>
                            </div>
                            <div className="stats-item">
                              <span className="stats-label">Botol Plastik</span>
                              <span className="stats-value">{item.result.accumulation.bottle} item</span>
                            </div>
                            <div className="stats-item">
                              <span className="stats-label">Kemasan/Wrapper</span>
                              <span className="stats-value">{item.result.accumulation.wrapper} item</span>
                            </div>
                            <div className="stats-item">
                              <span className="stats-label">📤 Total Upload</span>
                              <span className="stats-value">{item.result.accumulation.uploads} kali</span>
                            </div>
                          </div>
                          <p className="accumulation-note">
                            💡 Data akumulasi berdasarkan semua deteksi untuk lokasi {item.result.location}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="button-group">
              <button className="btn btn-secondary" onClick={resetAll}>🔄 Deteksi Baru</button>
              <button className="btn btn-secondary" onClick={onBack}>🏠 Kembali ke Beranda</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default DetectionPage
