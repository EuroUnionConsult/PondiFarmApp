import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Mapa para marcar a quinta, versão web (Leaflet + OpenStreetMap; no iPhone é Apple
 * Maps). O pino arrasta-se e tocar no mapa move-o. Pino desenhado em SVG: os ícones
 * por omissão do Leaflet são imagens que o empacotador não encontra.
 */
const PIN = L.divIcon({
  className: 'pf-pin',
  html: '<svg width="34" height="44" viewBox="0 0 34 44"><path d="M17 43C17 43 3 26 3 16a14 14 0 0 1 28 0c0 10-14 27-14 27z" fill="#2D7D46" stroke="#fff" stroke-width="2.5"/><circle cx="17" cy="16" r="5.5" fill="#fff"/></svg>',
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

export default function FarmMap({ lat, lon, onChange, height = 260 }: {
  lat: number; lon: number; onChange: (lat: number, lon: number) => void; height?: number;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!box.current || map.current) return;
    const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView([lat, lon], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '© OpenStreetMap',
    }).addTo(m);
    const mk = L.marker([lat, lon], { draggable: true, icon: PIN }).addTo(m);
    mk.on('dragend', () => { const p = mk.getLatLng(); cb.current(p.lat, p.lng); });
    m.on('click', (e: L.LeafletMouseEvent) => cb.current(e.latlng.lat, e.latlng.lng));
    map.current = m; marker.current = mk;
    // Dentro de um cartão que ainda está a ser medido: recalcula o tamanho.
    setTimeout(() => m.invalidateSize(), 60);
    return () => { m.remove(); map.current = null; marker.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    marker.current?.setLatLng([lat, lon]);
    map.current?.flyTo([lat, lon], Math.max(map.current.getZoom(), 11), { duration: 0.5 });
  }, [lat, lon]);

  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <div ref={box} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
