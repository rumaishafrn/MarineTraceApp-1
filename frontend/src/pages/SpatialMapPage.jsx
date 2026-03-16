import React, { useState, useEffect, useRef } from 'react'
import './SpatialMapPage.css'

const API = 'http://localhost:5000'

// Warna per kondisi
const CONDITION = {
  high:   { color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', label: '🔴 Tinggi  (≥10 item)',  emoji: '🔴' },
  medium: { color: '#f97316', bg: '#fff7ed', border: '#fdba74', label: '🟠 Sedang  (4–9 item)',  emoji: '🟠' },
  low:    { color: '#22c55e', bg: '#f0fdf4', border: '#86efac', label: '🟢 Rendah  (1–3 item)',  emoji: '🟢' },
}

export default function SpatialMapPage({ onBack }) {
  const [layers,          setLayers]         = useState({ high: [], medium: [], low: [] })
  const [summary,         setSummary]        = useState(null)
  const [loading,         setLoading]        = useState(true)
  const [error,           setError]          = useState(null)
  const [selectedPoint,   setSelectedPoint]  = useState(null)
  const [activeTab,       setActiveTab]      = useState('map')   // 'map' | 'stats'
  const [filterLocation,  setFilterLocation] = useState('')
  const [filterWaste,     setFilterWaste]    = useState('')
  const [visibleLayers,   setVisibleLayers]  = useState({ high: true, medium: true, low: true })
  const mapRef   = useRef(null)
  const leafletRef = useRef(null)   // Leaflet map instance
  const markersRef = useRef([])     // daftar marker aktif

  // ── Fetch data ──────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [layersRes, summaryRes] = await Promise.all([
        fetch(`${API}/api/spatial-map/layers`),
        fetch(`${API}/api/spatial-map/summary`),
      ])
      const layersData  = await layersRes.json()
      const summaryData = await summaryRes.json()

      if (layersData.success)  setLayers(layersData.layers)
      if (summaryData.success) setSummary(summaryData)
    } catch (e) {
      setError('Gagal memuat data. Pastikan backend berjalan di localhost:5000')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── Init Leaflet via CDN (tanpa npm package) ─────────────────────────────
  useEffect(() => {
    if (activeTab !== 'map') return

    // Load CSS Leaflet sekali
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id    = 'leaflet-css'
      link.rel   = 'stylesheet'
      link.href  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Load JS Leaflet sekali, lalu inisialisasi peta
    const initMap = () => {
      if (!mapRef.current || leafletRef.current) return
      const L = window.L
      const map = L.map(mapRef.current, { zoomControl: true }).setView([-5.135, 119.412], 8)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map)
      leafletRef.current = map
    }

    if (window.L) {
      setTimeout(initMap, 100)
    } else {
      const script    = document.createElement('script')
      script.src      = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload   = () => setTimeout(initMap, 100)
      document.head.appendChild(script)
    }
  }, [activeTab])

  // ── Render marker saat layers/filter berubah ────────────────────────────
  useEffect(() => {
    if (!leafletRef.current || activeTab !== 'map') return
    const L   = window.L
    if (!L) return
    const map = leafletRef.current

    // Hapus marker lama
    markersRef.current.forEach(m => map.removeLayer(m))
    markersRef.current = []

    const allPoints = []

    Object.entries(layers).forEach(([key, points]) => {
      if (!visibleLayers[key]) return
      const { color } = CONDITION[key]

      points
        .filter(p =>
          (!filterLocation || p.location === filterLocation) &&
          (!filterWaste    || p.dominant  === filterWaste)
        )
        .forEach(p => {
          const radius = 8 + Math.min(p.total_items, 14)
          const marker = L.circleMarker([p.lat, p.lon], {
            color, fillColor: color, fillOpacity: 0.75, weight: 2, radius
          })
          marker.bindPopup(`
            <div style="min-width:160px;font-family:sans-serif">
              <b style="font-size:14px">${p.location}</b><br/>
              <span style="color:#888;font-size:11px">${(p.created_at || '').slice(0, 10)}</span>
              <hr style="margin:6px 0"/>
              <span style="font-size:12px">📦 Jumlah: <b>${p.total_items}</b></span><br/>
              <span style="font-size:12px">🗑️ Dominan: <b>${p.dominant}</b></span><br/>
              <span style="font-size:12px">🛍️ Kantong: <b>${p.plastic_bag}</b></span><br/>
              <span style="font-size:12px">🍼 Botol: <b>${p.bottle}</b></span><br/>
              <span style="font-size:12px">📦 Kemasan: <b>${p.wrapper}</b></span><br/>
              <span style="font-size:12px">🎯 Akurasi: <b>${p.confidence ? (p.confidence * 100).toFixed(1) + '%' : '—'}</b></span>
              ${p.result_path ? `<br/><img src="${API}/results/${p.result_path.split('/').pop()}" style="margin-top:8px;width:100%;border-radius:6px;max-height:120px;object-fit:cover" onerror="this.style.display='none'"/>` : ''}
            </div>
          `, { maxWidth: 220 })
          marker.on('click', () => setSelectedPoint(p))
          marker.addTo(map)
          markersRef.current.push(marker)
          allPoints.push([p.lat, p.lon])
        })
    })

    // Auto-fit bounds
    if (allPoints.length > 0) {
      try { map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] }) } catch {}
    }
  }, [layers, visibleLayers, filterLocation, filterWaste, activeTab])

  // ── Resize map ketika tab berubah ────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'map' && leafletRef.current) {
      setTimeout(() => leafletRef.current.invalidateSize(), 200)
    }
  }, [activeTab])

  const allPoints   = [...layers.high, ...layers.medium, ...layers.low]
  const totalWaste  = allPoints.reduce((s, p) => s + (p.total_items || 0), 0)
  const locations   = [...new Set(allPoints.map(p => p.location))]
  const wasteTypes  = ['Kantong Plastik', 'Botol Plastik', 'Kemasan/Wrapper']

  const toggleLayer = (key) =>
    setVisibleLayers(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="spatial-page slide-in">
      <div className="container">

        {/* ── Back button ── */}
        <button className="btn btn-secondary back-btn" onClick={onBack}>
          ← Kembali ke Beranda
        </button>

        {/* ── Header ── */}
        <div className="content-box spatial-header">
          <div className="spatial-header-inner">
            <div>
              <h1>🗺️ Spatial Mapping Sampah</h1>
              <p className="description">
                Persebaran sampah laut berdasarkan koordinat deteksi — Takalar & Mamuju
              </p>
            </div>
            <div className="tab-switcher">
              <button
                className={`tab-btn ${activeTab === 'map' ? 'active' : ''}`}
                onClick={() => setActiveTab('map')}
              >🗺️ Peta</button>
              <button
                className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveTab('stats')}
              >📊 Statistik</button>
            </div>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="error-message">⚠️ {error}</div>
        )}

        {/* ── Summary cards ── */}
        <div className="summary-cards">
          <div className="summary-card blue">
            <span className="summary-icon">🗑️</span>
            <div><p className="summary-val">{totalWaste}</p><p className="summary-lbl">Total Sampah</p></div>
          </div>
          <div className="summary-card teal">
            <span className="summary-icon">📍</span>
            <div><p className="summary-val">{allPoints.length}</p><p className="summary-lbl">Titik Deteksi</p></div>
          </div>
          <div className="summary-card purple">
            <span className="summary-icon">🌊</span>
            <div><p className="summary-val">{locations.length}</p><p className="summary-lbl">Lokasi</p></div>
          </div>
          <div className="summary-card red">
            <span className="summary-icon">🚨</span>
            <div><p className="summary-val">{layers.high.length}</p><p className="summary-lbl">Kondisi Kritis</p></div>
          </div>
        </div>

        {/* ════════ TAB PETA ════════ */}
        {activeTab === 'map' && (
          <div className="map-layout">

            {/* ── Panel Kiri ── */}
            <div className="map-sidebar">

              {/* Filter */}
              <div className="sidebar-box">
                <p className="sidebar-title">🔍 Filter</p>
                <label className="sidebar-label">Lokasi</label>
                <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className="sidebar-select">
                  <option value="">Semua Lokasi</option>
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <label className="sidebar-label" style={{ marginTop: 12 }}>Jenis Sampah</label>
                <select value={filterWaste} onChange={e => setFilterWaste(e.target.value)} className="sidebar-select">
                  <option value="">Semua Jenis</option>
                  {wasteTypes.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>

              {/* Layer Toggle */}
              <div className="sidebar-box">
                <p className="sidebar-title">📌 Layer Kondisi</p>
                {Object.entries(CONDITION).map(([key, cfg]) => (
                  <div
                    key={key}
                    className={`layer-item ${visibleLayers[key] ? 'active' : 'inactive'}`}
                    onClick={() => toggleLayer(key)}
                  >
                    <span className="layer-dot" style={{ background: cfg.color }} />
                    <span className="layer-label">{cfg.label}</span>
                    <span className="layer-count">{layers[key]?.length || 0}</span>
                    <span className="layer-toggle">{visibleLayers[key] ? '👁️' : '🚫'}</span>
                  </div>
                ))}
              </div>

              {/* Detail titik terpilih */}
              {selectedPoint && (
                <div className="sidebar-box detail-box">
                  <div className="detail-header">
                    <p className="sidebar-title">📋 Detail Titik</p>
                    <button onClick={() => setSelectedPoint(null)} className="close-btn">✕</button>
                  </div>
                  <p className="detail-location">{selectedPoint.location}</p>
                  <p className="detail-date">{(selectedPoint.created_at || '').slice(0, 16)}</p>
                  <div className="detail-rows">
                    <div className="detail-row"><span>📦 Total</span><b>{selectedPoint.total_items}</b></div>
                    <div className="detail-row"><span>🛍️ Kantong Plastik</span><b>{selectedPoint.plastic_bag}</b></div>
                    <div className="detail-row"><span>🍼 Botol Plastik</span><b>{selectedPoint.bottle}</b></div>
                    <div className="detail-row"><span>📦 Kemasan</span><b>{selectedPoint.wrapper}</b></div>
                    <div className="detail-row"><span>🎯 Akurasi</span>
                      <b>{selectedPoint.confidence ? (selectedPoint.confidence * 100).toFixed(1) + '%' : '—'}</b>
                    </div>
                    <div className="detail-row coord">
                      <span>📍</span>
                      <b>{selectedPoint.lat?.toFixed(5)}, {selectedPoint.lon?.toFixed(5)}</b>
                    </div>
                  </div>
                  {selectedPoint.result_path && (
                    <img
                      src={`${API}/results/${selectedPoint.result_path.split('/').pop()}`}
                      alt="Hasil deteksi"
                      className="detail-img"
                      onError={e => e.target.style.display = 'none'}
                    />
                  )}
                </div>
              )}
            </div>

            {/* ── Peta ── */}
            <div className="map-wrapper">
              {loading ? (
                <div className="map-loading">
                  <div className="spinner" />
                  <p>Memuat data peta...</p>
                </div>
              ) : (
                <div ref={mapRef} className="leaflet-map" />
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB STATISTIK ════════ */}
        {activeTab === 'stats' && (
          <StatsPanel summary={summary} layers={layers} />
        )}

      </div>
    </div>
  )
}

// ── Panel Statistik ──────────────────────────────────────────────────────────
function StatsPanel({ summary, layers }) {
  if (!summary) return (
    <div className="content-box" style={{ textAlign: 'center', padding: '60px', color: '#888' }}>
      Memuat statistik...
    </div>
  )

  const dist = summary.waste_distribution || {}
  const distEntries = Object.entries(dist)
  const maxDist = Math.max(...distEntries.map(([, v]) => v), 1)

  const allPoints  = [...(layers.high || []), ...(layers.medium || []), ...(layers.low || [])]
  const totalWaste = allPoints.reduce((s, p) => s + (p.total_items || 0), 0)

  const trend   = summary.daily_trend || []
  const maxTrend = Math.max(...trend.map(d => d.total_waste), 1)

  return (
    <div className="stats-panels">

      {/* Akumulasi per Lokasi */}
      <div className="content-box stats-box">
        <h3 className="stats-box-title">📍 Akumulasi per Lokasi</h3>
        {(summary.location_summary || []).length === 0
          ? <p className="empty-hint">Belum ada data deteksi dengan koordinat.</p>
          : (summary.location_summary || []).map(loc => {
              const pct = totalWaste > 0 ? Math.round((loc.total_waste / totalWaste) * 100) : 0
              return (
                <div key={loc.location} className="bar-row">
                  <div className="bar-meta">
                    <span className="bar-name">{loc.location}</span>
                    <span className="bar-val">{loc.total_waste} item</span>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill blue" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="bar-sub">{loc.detection_count} kali deteksi · akurasi avg {loc.avg_confidence ? (loc.avg_confidence * 100).toFixed(1) + '%' : '—'}</p>
                </div>
              )
            })
        }
      </div>

      {/* Distribusi Jenis Sampah */}
      <div className="content-box stats-box">
        <h3 className="stats-box-title">🗑️ Distribusi Jenis Sampah</h3>
        {distEntries.map(([name, val], i) => {
          const colors = ['blue', 'teal', 'purple']
          const pct    = Math.round((val / maxDist) * 100)
          return (
            <div key={name} className="bar-row">
              <div className="bar-meta">
                <span className="bar-name">{name}</span>
                <span className="bar-val">{val} item</span>
              </div>
              <div className="bar-track">
                <div className={`bar-fill ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Kondisi Layer */}
      <div className="content-box stats-box">
        <h3 className="stats-box-title">🗂️ Ringkasan Kondisi</h3>
        <div className="condition-cards">
          {Object.entries(CONDITION).map(([key, cfg]) => (
            <div key={key} className="condition-card" style={{ background: cfg.bg, borderColor: cfg.border }}>
              <p className="condition-val" style={{ color: cfg.color }}>{layers[key]?.length || 0}</p>
              <p className="condition-lbl" style={{ color: cfg.color }}>{cfg.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tren Harian */}
      <div className="content-box stats-box full-width">
        <h3 className="stats-box-title">📈 Tren Deteksi 14 Hari Terakhir</h3>
        {trend.length === 0
          ? <p className="empty-hint">Belum ada data 14 hari terakhir.</p>
          : (
            <div className="trend-chart">
              {trend.map(day => {
                const h = Math.max(4, Math.round((day.total_waste / maxTrend) * 120))
                return (
                  <div key={day.date} className="trend-bar-wrap" title={`${day.date}: ${day.total_waste} item`}>
                    <span className="trend-val">{day.total_waste}</span>
                    <div className="trend-bar" style={{ height: h }} />
                    <span className="trend-date">{(day.date || '').slice(5)}</span>
                  </div>
                )
              })}
            </div>
          )
        }
      </div>

    </div>
  )
}
