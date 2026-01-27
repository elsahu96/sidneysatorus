import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Ship, AlertTriangle, Key, Play, Pause } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';

// Key locations mentioned in the report
const locations = {
  iranianPorts: [
    { name: 'Bandar Imam Khomeini', coords: [49.0758, 30.4394], type: 'origin' },
    { name: 'Assaluyeh', coords: [52.6167, 27.4833], type: 'origin' }
  ],
  transferZones: [
    { name: 'Fujairah (UAE)', coords: [56.3260, 25.1288], type: 'sts' },
    { name: 'Johor (Malaysia)', coords: [103.7414, 1.4854], type: 'sts' }
  ],
  destinations: [
    { name: 'Dalian (China)', coords: [121.6147, 38.9140], type: 'destination' }
  ]
};

// Typical evasion routes (following maritime shipping lanes)
const routes = [
  {
    name: 'Persian Gulf to Fujairah',
    coordinates: [
      [49.0758, 30.4394],  // Bandar Imam Khomeini
      [50.0, 29.0],        // South through Persian Gulf
      [51.5, 27.5],        // Assaluyeh area
      [53.0, 26.5],        // Through Strait of Hormuz
      [55.0, 25.5],        // Gulf of Oman
      [56.3260, 25.1288]   // Fujairah (UAE)
    ],
    description: 'Primary STS transfer zone',
    duration: '2-3 days',
    color: '#ef4444'
  },
  {
    name: 'Fujairah to Johor',
    coordinates: [
      [56.3260, 25.1288],  // Fujairah
      [58.0, 24.0],        // Arabian Sea
      [65.0, 20.0],        // West of India
      [70.0, 12.0],        // South of India
      [80.0, 8.0],         // Sri Lanka passage
      [90.0, 6.0],         // Bay of Bengal
      [95.0, 5.0],         // Andaman Sea
      [98.0, 3.0],         // Approaching Malacca Strait
      [100.5, 2.0],        // Through Malacca Strait
      [103.7414, 1.4854]   // Johor (Malaysia)
    ],
    description: 'Post-transfer route through Malacca Strait',
    duration: '12-14 days',
    color: '#f59e0b'
  },
  {
    name: 'Johor to Dalian',
    coordinates: [
      [103.7414, 1.4854],  // Johor
      [105.0, 3.0],        // South China Sea
      [110.0, 8.0],        // East through South China Sea
      [115.0, 15.0],       // Approaching Taiwan Strait
      [118.0, 22.0],       // Taiwan Strait
      [120.0, 28.0],       // East China Sea
      [121.0, 33.0],       // Approaching Yellow Sea
      [121.6147, 38.9140]  // Dalian (China)
    ],
    description: 'Final leg to China',
    duration: '7-9 days',
    color: '#3b82f6'
  }
];


export const MaritimeVisualization = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [activeRoute, setActiveRoute] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationFrameRef = useRef<number | null>(null);
  const animatedMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const MAPBOX_TOKEN = 'pk.eyJ1IjoiaGFycnlhbGRlcm1hbiIsImEiOiJjbWh3YW5jdWEwM2JsMmpzOTdmODgzZmxtIn0.KDp8M1nFNgbaLgLvY4wb9g';

  const animateVessels = () => {
    if (!map.current || !isAnimating) return;

    const startTime = Date.now();
    const animationDuration = 30000; // 30 seconds for full journey

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = (elapsed % animationDuration) / animationDuration;

      routes.forEach((route, routeIndex) => {
        const totalPoints = route.coordinates.length;
        const currentSegment = Math.floor(progress * (totalPoints - 1));
        const segmentProgress = (progress * (totalPoints - 1)) % 1;

        if (currentSegment < totalPoints - 1) {
          const start = route.coordinates[currentSegment];
          const end = route.coordinates[currentSegment + 1];
          
          const lng = start[0] + (end[0] - start[0]) * segmentProgress;
          const lat = start[1] + (end[1] - start[1]) * segmentProgress;

          if (animatedMarkersRef.current[routeIndex]) {
            animatedMarkersRef.current[routeIndex].setLngLat([lng, lat]);
          }
        }
      });

      if (isAnimating) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();
  };

  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [80, 25],
      zoom: 3.5,
      pitch: 0,
      attributionControl: false
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      if (!map.current) return;

      // Add routes
      routes.forEach((route, index) => {
        map.current!.addSource(`route-${index}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {
              name: route.name,
              description: route.description,
              duration: route.duration
            },
            geometry: {
              type: 'LineString',
              coordinates: route.coordinates
            }
          }
        });

        map.current!.addLayer({
          id: `route-${index}`,
          type: 'line',
          source: `route-${index}`,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': route.color,
            'line-width': 3,
            'line-opacity': 0.6,
            'line-dasharray': [2, 2]
          }
        });

        // Add hover effect to show transit time
        map.current!.on('mouseenter', `route-${index}`, () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = 'pointer';
          }
        });

        map.current!.on('mouseleave', `route-${index}`, () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = '';
          }
        });

        // Show popup on hover
        const routePopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false
        });

        map.current!.on('mousemove', `route-${index}`, (e) => {
          if (!map.current || !e.lngLat) return;
          
          routePopup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div style="padding: 8px; background: rgba(0,0,0,0.95); border-radius: 6px; border: 2px solid ${route.color};">
                <strong style="color: ${route.color}; font-size: 13px;">${route.name}</strong>
                <p style="color: #fff; font-size: 13px; margin: 4px 0 0 0; font-weight: 600;">⏱️ ${route.duration}</p>
              </div>`
            )
            .addTo(map.current);
        });

        map.current!.on('mouseleave', `route-${index}`, () => {
          routePopup.remove();
        });

        // Create animated vessel markers with distinct colors
        const vesselEl = document.createElement('div');
        vesselEl.innerHTML = `
          <svg width="30" height="30" viewBox="0 0 24 24" fill="${route.color}" stroke="#ffffff" stroke-width="1.5">
            <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
            <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
            <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
            <path d="M12 10v4"/>
            <path d="M12 2v3"/>
          </svg>
        `;
        vesselEl.style.cursor = 'pointer';

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
          `<div style="padding: 8px; background: rgba(0,0,0,0.9); border-radius: 4px;">
            <strong style="color: ${route.color}; font-size: 14px;">${route.name}</strong>
            <p style="color: #aaa; font-size: 12px; margin: 4px 0 0 0;">Transit Time: ${route.duration}</p>
            <p style="color: #f59e0b; font-size: 11px; margin: 2px 0 0 0;">🚢 Active Route</p>
          </div>`
        );

        const marker = new mapboxgl.Marker(vesselEl)
          .setLngLat(route.coordinates[0] as [number, number])
          .setPopup(popup)
          .addTo(map.current!);

        animatedMarkersRef.current[index] = marker;
      });

      // Add location markers
      const allLocations = [
        ...locations.iranianPorts,
        ...locations.transferZones,
        ...locations.destinations
      ];

      allLocations.forEach((location) => {
        const el = document.createElement('div');
        el.className = 'location-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.border = '3px solid';
        el.style.cursor = 'pointer';
        
        if (location.type === 'origin') {
          el.style.backgroundColor = '#ef4444';
          el.style.borderColor = '#dc2626';
        } else if (location.type === 'sts') {
          el.style.backgroundColor = '#f59e0b';
          el.style.borderColor = '#d97706';
        } else {
          el.style.backgroundColor = '#3b82f6';
          el.style.borderColor = '#2563eb';
        }

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false }).setHTML(
          `<div style="padding: 8px; background: rgba(0,0,0,0.9); border-radius: 4px;">
            <strong style="color: #fff; font-size: 14px;">${location.name}</strong>
            <p style="color: #aaa; font-size: 12px; margin: 4px 0 0 0;">
              ${location.type === 'origin' ? 'Iranian Export Terminal' : 
                location.type === 'sts' ? 'Ship-to-Ship Transfer Zone' : 
                'Destination Port'}
            </p>
          </div>`
        );

        new mapboxgl.Marker(el)
          .setLngLat(location.coords as [number, number])
          .setPopup(popup)
          .addTo(map.current!);
      });

    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animatedMarkersRef.current.forEach(marker => marker.remove());
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (isAnimating) {
      animateVessels();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isAnimating]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground mb-2 flex items-center gap-2">
            <Ship className="h-6 w-6 text-primary" />
            Maritime Intelligence Map
          </h2>
          <p className="text-sm text-muted-foreground">
            Key locations, routes, and sanctioned vessels from OFAC data
          </p>
        </div>
        <Button
          onClick={toggleAnimation}
          variant={isAnimating ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          {isAnimating ? (
            <>
              <Pause className="h-4 w-4" />
              Pause Animation
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Animate Routes
            </>
          )}
        </Button>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-border bg-card">
        <div ref={mapContainer} className="w-full h-[500px]" />
        
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-sm rounded-lg border border-border p-4 space-y-2">
          <div className="text-xs font-semibold text-foreground mb-2">Legend</div>
          <div className="flex items-center gap-2 text-xs text-foreground/90">
            <div className="w-3 h-3 rounded-full bg-[#ef4444] border-2 border-[#dc2626]"></div>
            <span>Iranian Export Terminals</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/90">
            <div className="w-3 h-3 rounded-full bg-[#f59e0b] border-2 border-[#d97706]"></div>
            <span>STS Transfer Zones</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/90">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6] border-2 border-[#2563eb]"></div>
            <span>Destination Ports</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/90">
            <div className="w-4 h-0.5 bg-gradient-to-r from-[#ef4444] via-[#f59e0b] to-[#3b82f6] opacity-60"></div>
            <span>Evasion Routes (hover for timing)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground/90">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
              <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
              <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.5">
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/>
              <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/>
            </svg>
            <span>Active Route Vessels</span>
          </div>
        </div>
      </div>

      {/* Data Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card/50 border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary mb-1">2</div>
          <div className="text-xs text-muted-foreground">Iranian Export Terminals</div>
        </div>
        <div className="bg-card/50 border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary mb-1">2</div>
          <div className="text-xs text-muted-foreground">STS Transfer Zones</div>
        </div>
        <div className="bg-card/50 border border-border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary mb-1">21-26</div>
          <div className="text-xs text-muted-foreground">Total Transit Days</div>
        </div>
      </div>
    </section>
  );
};
