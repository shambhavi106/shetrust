import React, { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import { BENGALURU_CENTER, getStiColor, fmtSTI } from '../utils/helpers';
import { useLocations } from '../hooks/useLocations';
import styles from './SafeRoute.module.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/walking';

// Score a route based on proximity to known safe/risky locations
function scoreRouteSafety(routeCoords, locations, slot) {
  if (!locations.length || !routeCoords.length) return null;
  let total = 0, count = 0;
  // Sample every Nth coord to keep it fast
  const step = Math.max(1, Math.floor(routeCoords.length / 20));
  for (let i = 0; i < routeCoords.length; i += step) {
    const [lng, lat] = routeCoords[i];
    let nearest = null, nearestDist = Infinity;
    for (const loc of locations) {
      const [lLng, lLat] = loc.location?.coordinates || [];
      if (!lLng) continue;
      const d = Math.hypot(lng - lLng, lat - lLat);
      if (d < nearestDist) { nearestDist = d; nearest = loc; }
    }
    if (nearest && nearestDist < 0.03) { // ~3km radius
      const slotData = nearest.timeSlots?.find(s => s.slot === slot);
      if (slotData?.sti != null) { total += slotData.sti; count++; }
    }
  }
  return count > 0 ? Math.round((total / count) * 10) / 10 : null;
}

function getSafetyLabel(score) {
  if (score === null) return { label: 'Unknown', color: '#6B7280', emoji: '⚫' };
  if (score >= 7.5) return { label: 'Safe Route', color: '#22C55E', emoji: '🟢' };
  if (score >= 5)   return { label: 'Moderate', color: '#F59E0B', emoji: '🟡' };
  return             { label: 'Use Caution', color: '#EF4444', emoji: '🔴' };
}

async function fetchRoute(from, to, token) {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `${MAPBOX_DIRECTIONS_URL}/${coords}?alternatives=true&geometries=geojson&overview=full&access_token=${token}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.routes?.length) throw new Error('No route found');
  return data.routes;
}

export default function SafeRoute({ slot }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromCoords, setFromCoords] = useState(null);
  const [toCoords, setToCoords] = useState(null);
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useMyLocation, setUseMyLocation] = useState(false);

  const { locations } = useLocations();

  // ── Init map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapboxgl.accessToken) return;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: BENGALURU_CENTER,
      zoom: 11.5,
      pitchWithRotate: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('load', () => {
      // Route layers (up to 3 alternatives)
      for (let i = 0; i < 3; i++) {
        map.addSource(`route-${i}`, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: `route-line-${i}`,
          type: 'line',
          source: `route-${i}`,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': i === 0 ? '#E63B6F' : '#4B5563',
            'line-width': i === 0 ? 5 : 3,
            'line-opacity': i === 0 ? 0.95 : 0.5,
          },
        });
      }
      // Markers layer for from/to
      map.addSource('markers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'markers-layer',
        type: 'circle',
        source: 'markers',
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
      setMapReady(true);
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Update route lines on map ─────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    routes.forEach((r, i) => {
      const src = map.getSource(`route-${i}`);
      if (src) src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: r.geometry }] });
      if (map.getLayer(`route-line-${i}`)) {
        const isSelected = i === selectedRoute;
        map.setPaintProperty(`route-line-${i}`, 'line-color', isSelected ? '#E63B6F' : '#4B5563');
        map.setPaintProperty(`route-line-${i}`, 'line-width', isSelected ? 5 : 3);
        map.setPaintProperty(`route-line-${i}`, 'line-opacity', isSelected ? 0.95 : 0.45);
      }
    });
    // Clear unused route sources
    for (let i = routes.length; i < 3; i++) {
      const src = map.getSource(`route-${i}`);
      if (src) src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [routes, selectedRoute, mapReady]);

  // ── Update markers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const features = [];
    if (fromCoords) features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: fromCoords }, properties: { color: '#22C55E' } });
    if (toCoords)   features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: toCoords },   properties: { color: '#E63B6F' } });
    const src = mapRef.current.getSource('markers');
    if (src) src.setData({ type: 'FeatureCollection', features });
  }, [fromCoords, toCoords, mapReady]);

  // ── Geocode helper ────────────────────────────────────────────────────
  const geocode = async (text, setSuggestions) => {
    if (!text || text.length < 3) { setSuggestions([]); return; }
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?proximity=77.5946,12.9716&bbox=77.35,12.75,77.85,13.15&country=in&access_token=${token}&limit=4`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch { setSuggestions([]); }
  };

  const debounceRef = useRef({});
  const debouncedGeocode = (key, text, setSuggestions) => {
    clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => geocode(text, setSuggestions), 400);
  };

  // ── Get route ─────────────────────────────────────────────────────────
  const findRoutes = useCallback(async () => {
    if (!fromCoords || !toCoords) { setError('Please select both a start and destination.'); return; }
    setError(''); setLoading(true); setRoutes([]);
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      const rawRoutes = await fetchRoute(fromCoords, toCoords, token);
      // Score each route
      const scored = rawRoutes.map((r, i) => ({
        ...r,
        index: i,
        safetyScore: scoreRouteSafety(r.geometry.coordinates, locations, slot),
      }));
      // Sort: safest first
      scored.sort((a, b) => (b.safetyScore ?? 5) - (a.safetyScore ?? 5));
      setRoutes(scored);
      setSelectedRoute(0);
      // Fit map to route bounds
      if (mapRef.current && scored[0]?.geometry?.coordinates?.length) {
        const coords = scored[0].geometry.coordinates;
        const bounds = coords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(coords[0], coords[0]));
        mapRef.current.fitBounds(bounds, { padding: 60, duration: 800 });
      }
    } catch (e) {
      setError('Could not find a route. Try different locations.');
    } finally { setLoading(false); }
  }, [fromCoords, toCoords, locations, slot]);

  // ── Use my location ───────────────────────────────────────────────────
  const handleMyLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        setFromCoords(coords);
        setFrom('My Current Location');
        setFromSuggestions([]);
        setUseMyLocation(true);
      },
      () => setError('Could not get your location. Please allow location access.')
    );
  };

  const selectSuggestion = (place, isFrom) => {
    const coords = place.center;
    const name = place.place_name?.split(',').slice(0, 2).join(', ') || place.text;
    if (isFrom) { setFrom(name); setFromCoords(coords); setFromSuggestions([]); }
    else        { setTo(name);   setToCoords(coords);   setToSuggestions([]); }
  };

  const noToken = !import.meta.env.VITE_MAPBOX_TOKEN;

  return (
    <div className={styles.page}>
      {/* ── Panel ─────────────────────────────────────────────────────── */}
      <aside className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>🛡️ Safe Route Finder</div>
          <div className={styles.panelSub}>Find the safest path between two locations in Bengaluru</div>
        </div>

        {/* From */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            <span className={styles.dot} style={{ background: '#22C55E' }} /> From
          </label>
          <div className={styles.inputRow}>
            <div className={styles.inputWrap}>
              <input
                className={styles.input}
                placeholder="Start location…"
                value={from}
                onChange={e => { setFrom(e.target.value); setFromCoords(null); debouncedGeocode('from', e.target.value, setFromSuggestions); }}
              />
              {fromSuggestions.length > 0 && (
                <div className={styles.suggestions}>
                  {fromSuggestions.map(s => (
                    <button key={s.id} className={styles.suggestion} onClick={() => selectSuggestion(s, true)}>
                      <span className={styles.suggIcon}>📍</span>
                      <div>
                        <div className={styles.suggName}>{s.text}</div>
                        <div className={styles.suggSub}>{s.place_name?.split(',').slice(1, 3).join(',').trim()}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className={styles.locBtn} onClick={handleMyLocation} title="Use my location">📡</button>
          </div>
        </div>

        {/* To */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>
            <span className={styles.dot} style={{ background: '#E63B6F' }} /> To
          </label>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              placeholder="Destination…"
              value={to}
              onChange={e => { setTo(e.target.value); setToCoords(null); debouncedGeocode('to', e.target.value, setToSuggestions); }}
            />
            {toSuggestions.length > 0 && (
              <div className={styles.suggestions}>
                {toSuggestions.map(s => (
                  <button key={s.id} className={styles.suggestion} onClick={() => selectSuggestion(s, false)}>
                    <span className={styles.suggIcon}>📍</span>
                    <div>
                      <div className={styles.suggName}>{s.text}</div>
                      <div className={styles.suggSub}>{s.place_name?.split(',').slice(1, 3).join(',').trim()}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          className={styles.findBtn}
          onClick={findRoutes}
          disabled={loading || !fromCoords || !toCoords}
        >
          {loading ? '⏳ Finding safest route…' : '🔍 Find Safe Route'}
        </button>

        {error && <div className={styles.error}>{error}</div>}

        {/* Route results */}
        {routes.length > 0 && (
          <div className={styles.routeList}>
            <div className={styles.routeListTitle}>
              {routes.length} route{routes.length > 1 ? 's' : ''} found — sorted by safety
            </div>
            {routes.map((r, i) => {
              const safety = getSafetyLabel(r.safetyScore);
              const mins = Math.round(r.duration / 60);
              const km = (r.distance / 1000).toFixed(1);
              return (
                <button
                  key={i}
                  className={`${styles.routeCard} ${selectedRoute === i ? styles.routeCardActive : ''}`}
                  onClick={() => setSelectedRoute(i)}
                >
                  <div className={styles.routeTop}>
                    <span className={styles.routeLabel}>
                      {i === 0 ? '⭐ Safest' : `Route ${i + 1}`}
                    </span>
                    <span className={styles.routeSafety} style={{ color: safety.color }}>
                      {safety.emoji} {safety.label}
                    </span>
                  </div>
                  <div className={styles.routeMeta}>
                    <span>🕐 {mins} min</span>
                    <span>📏 {km} km</span>
                    {r.safetyScore !== null && (
                      <span style={{ color: safety.color }}>STI {fmtSTI(r.safetyScore)}</span>
                    )}
                  </div>
                  {i === 0 && r.safetyScore !== null && (
                    <div className={styles.routeTip}>
                      Safety score based on {locations.length} community-rated locations along this route
                    </div>
                  )}
                </button>
              );
            })}

            {/* Safety tips */}
            <div className={styles.safetyTips}>
              <div className={styles.tipsTitle}>🛡️ Stay safe</div>
              <ul className={styles.tipsList}>
                <li>Share your live location with a trusted contact</li>
                <li>Prefer well-lit, populated streets after dark</li>
                <li>Use the SOS button if you feel unsafe</li>
              </ul>
            </div>
          </div>
        )}

        {noToken && (
          <div className={styles.noToken}>
            ⚠️ Set <code>VITE_MAPBOX_TOKEN</code> in <code>.env</code> to enable routing
          </div>
        )}
      </aside>

      {/* ── Map ───────────────────────────────────────────────────────── */}
      <div className={styles.mapWrap}>
        <div ref={mapContainerRef} className={styles.map} />
        {!routes.length && !loading && (
          <div className={styles.mapOverlay}>
            <div className={styles.mapOverlayText}>Enter a start and destination to find your safest route</div>
          </div>
        )}
        {/* Route legend */}
        {routes.length > 0 && (
          <div className={styles.routeLegend}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 24, height: 4, borderRadius: 2, background: '#E63B6F', display: 'inline-block' }} />
              <span>Selected route</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 24, height: 3, borderRadius: 2, background: '#4B5563', display: 'inline-block' }} />
              <span>Alternate route</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
