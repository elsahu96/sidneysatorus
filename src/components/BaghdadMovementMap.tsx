import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ShieldAlert } from 'lucide-react';

// Restricted zones - areas to avoid
const restrictedZones = [
  {
    name: 'Sadr City',
    center: [44.4558, 33.4060] as [number, number],
    radius: 0.03,
    level: 'critical'
  },
  {
    name: 'Baghdad al-Jadida',
    center: [44.4700, 33.3500] as [number, number],
    radius: 0.025,
    level: 'critical'
  },
  {
    name: 'Rustamiyah Belt',
    center: [44.5100, 33.3100] as [number, number],
    radius: 0.028,
    level: 'high'
  }
];

// Safe compound locations (example)
const safeCompounds = [
  { name: 'IZ Green Zone', coords: [44.3650, 33.3100] as [number, number] },
  { name: 'Karada District', coords: [44.4100, 33.3050] as [number, number] },
  { name: 'Mansour District', coords: [44.3400, 33.3200] as [number, number] },
];

// Generate circle coordinates
const createCircle = (center: [number, number], radius: number, points: number = 64) => {
  const coords: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    coords.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle) * 0.8
    ]);
  }
  return coords;
};

export const BaghdadMovementMap = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGFycnlhbGRlcm1hbiIsImEiOiJjbWh3YW5jdWEwM2JsMmpzOTdmODgzZmxtIn0.KDp8M1nFNgbaLgLvY4wb9g';

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [44.42, 33.34],
      zoom: 11,
      pitch: 30,
      bearing: 0,
      attributionControl: false,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    map.current.on('load', () => {
      if (!map.current) return;

      // Add restricted zones as polygon layers
      restrictedZones.forEach((zone, index) => {
        const circleCoords = createCircle(zone.center, zone.radius);
        
        map.current!.addSource(`restricted-zone-${index}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: zone.name, level: zone.level },
            geometry: {
              type: 'Polygon',
              coordinates: [circleCoords]
            }
          }
        });

        // Fill layer
        map.current!.addLayer({
          id: `restricted-fill-${index}`,
          type: 'fill',
          source: `restricted-zone-${index}`,
          paint: {
            'fill-color': zone.level === 'critical' ? '#ef4444' : '#f97316',
            'fill-opacity': 0.3
          }
        });

        // Border layer with dashed line
        map.current!.addLayer({
          id: `restricted-border-${index}`,
          type: 'line',
          source: `restricted-zone-${index}`,
          paint: {
            'line-color': zone.level === 'critical' ? '#ef4444' : '#f97316',
            'line-width': 2,
            'line-dasharray': [2, 2]
          }
        });

        // Add zone label
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            background: ${zone.level === 'critical' ? 'rgba(239, 68, 68, 0.9)' : 'rgba(249, 115, 22, 0.9)'};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            ⛔ ${zone.name}
          </div>
        `;
        
        new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat(zone.center)
          .addTo(map.current!);
      });

      // Add safe compound markers
      safeCompounds.forEach(compound => {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="
            width: 28px;
            height: 28px;
            background: #22c55e;
            border: 2px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
        `;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
        }).setHTML(`
          <div style="padding: 8px;">
            <div style="font-weight: 600; color: #22c55e; font-size: 12px;">${compound.name}</div>
            <div style="font-size: 11px; color: #666;">Safe compound - approved for transit</div>
          </div>
        `);

        new mapboxgl.Marker(el)
          .setLngLat(compound.coords)
          .setPopup(popup)
          .addTo(map.current!);
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
      <div className="bg-orange-500/10 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-orange-500" />
          <h4 className="font-semibold text-foreground">72-Hour Movement Restrictions</h4>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Suspend non-essential movements in highlighted zones
        </p>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="h-[350px] w-full" />

      {/* Legend */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500 border-dashed" />
            <span className="text-foreground/80">Critical - No movement</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-orange-500/30 border border-orange-500 border-dashed" />
            <span className="text-foreground/80">High risk - Avoid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
            <span className="text-foreground/80">Safe compound</span>
          </div>
        </div>
      </div>
    </div>
  );
};
