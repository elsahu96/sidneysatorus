import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AlertTriangle, MapPin } from 'lucide-react';

// Threat zone coordinates for East Baghdad
const threatZones = [
  {
    name: 'Sadr City (Thawra districts)',
    coords: [44.4558, 33.4060] as [number, number],
    threat: 'high',
    description: 'Consistent militia recruitment narratives; multiple mentions of weapons availability.',
    color: '#ef4444'
  },
  {
    name: 'Baghdad al-Jadida',
    coords: [44.4700, 33.3500] as [number, number],
    threat: 'high',
    description: 'Proximity to reported volunteer mobilisation calls tied to East Baghdad rhetoric.',
    color: '#f97316'
  },
  {
    name: 'Rustamiyah corridor',
    coords: [44.5100, 33.3100] as [number, number],
    threat: 'medium-high',
    description: 'Aligns with historic AAH transit routes and discussions regarding "volunteers entering the fray."',
    color: '#eab308'
  }
];

// Additional points for heatmap density
const heatmapPoints = [
  // Sadr City cluster
  { coords: [44.4558, 33.4060], intensity: 1.0 },
  { coords: [44.4400, 33.4100], intensity: 0.8 },
  { coords: [44.4700, 33.4000], intensity: 0.9 },
  { coords: [44.4500, 33.4200], intensity: 0.7 },
  { coords: [44.4650, 33.4150], intensity: 0.85 },
  // Baghdad al-Jadida cluster
  { coords: [44.4700, 33.3500], intensity: 0.9 },
  { coords: [44.4600, 33.3450], intensity: 0.75 },
  { coords: [44.4800, 33.3550], intensity: 0.8 },
  { coords: [44.4750, 33.3400], intensity: 0.7 },
  // Rustamiyah cluster
  { coords: [44.5100, 33.3100], intensity: 0.85 },
  { coords: [44.5000, 33.3000], intensity: 0.7 },
  { coords: [44.5200, 33.3200], intensity: 0.75 },
  { coords: [44.5050, 33.3150], intensity: 0.65 },
];

export const BaghdadThreatHeatmap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGFycnlhbGRlcm1hbiIsImEiOiJjbWh3YW5jdWEwM2JsMmpzOTdmODgzZmxtIn0.KDp8M1nFNgbaLgLvY4wb9g';

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [44.48, 33.36],
      zoom: 11.5,
      pitch: 45,
      bearing: -10,
      attributionControl: false,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    map.current.on('load', () => {
      if (!map.current) return;

      // Add heatmap source
      map.current.addSource('threat-heat', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: heatmapPoints.map(point => ({
            type: 'Feature' as const,
            properties: { intensity: point.intensity },
            geometry: {
              type: 'Point' as const,
              coordinates: point.coords
            }
          }))
        }
      });

      // Add heatmap layer
      map.current.addLayer({
        id: 'threat-heatmap',
        type: 'heatmap',
        source: 'threat-heat',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['get', 'intensity'],
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 1,
            15, 3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(254,240,217,0.6)',
            0.4, 'rgba(253,204,138,0.7)',
            0.6, 'rgba(252,141,89,0.8)',
            0.8, 'rgba(227,74,51,0.9)',
            1, 'rgba(179,0,0,1)'
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10, 40,
            15, 80
          ],
          'heatmap-opacity': 0.7
        }
      });

      // Add markers for threat zones
      threatZones.forEach(zone => {
        const el = document.createElement('div');
        el.className = 'threat-marker';
        el.innerHTML = `
          <div style="
            width: 32px;
            height: 32px;
            background: ${zone.color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            cursor: pointer;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: 'threat-popup'
        }).setHTML(`
          <div style="padding: 12px; max-width: 250px;">
            <div style="font-weight: 600; color: #ef4444; margin-bottom: 4px; font-size: 14px;">
              ${zone.name}
            </div>
            <div style="font-size: 12px; color: #666; line-height: 1.4;">
              ${zone.description}
            </div>
            <div style="margin-top: 8px; font-size: 11px; color: ${zone.color}; font-weight: 500;">
              Threat Level: ${zone.threat.toUpperCase()}
            </div>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat(zone.coords)
          .setPopup(popup)
          .addTo(map.current!);

        el.addEventListener('mouseenter', () => setHoveredZone(zone.name));
        el.addEventListener('mouseleave', () => setHoveredZone(null));
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  return (
    <div className="rounded-lg overflow-hidden border border-border bg-card">
      {/* Header */}
      <div className="bg-destructive/10 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h4 className="font-semibold text-foreground">East Baghdad Threat Convergence Zones</h4>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Areas with highest concentration of AAH-linked threat signals
        </p>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="h-[350px] w-full" />

      {/* Legend */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border">
        <div className="flex flex-wrap gap-4 text-xs">
          {threatZones.map(zone => (
            <div 
              key={zone.name} 
              className={`flex items-center gap-2 transition-opacity ${
                hoveredZone && hoveredZone !== zone.name ? 'opacity-50' : ''
              }`}
            >
              <div 
                className="w-3 h-3 rounded-full border border-white/50"
                style={{ backgroundColor: zone.color }}
              />
              <span className="text-foreground/80">{zone.name}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-yellow-200 via-orange-400 to-red-700" />
          <span className="text-xs text-muted-foreground">Threat Intensity</span>
        </div>
      </div>
    </div>
  );
};
