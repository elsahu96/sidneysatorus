import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_API_KEY;

export type GeolocationItem = {
  entity: string;
  coordinates: [number, number];
  context: string;
};

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Mapbox map that shows investigation geolocations as markers with popups. */
export const InvestigationGeolocationsMap = ({ geolocations }: { geolocations: GeolocationItem[] }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current || geolocations.length === 0 || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    // API returns [lat, lng]; Mapbox uses [lng, lat]
    const lngLats = geolocations.map((loc) => [loc.coordinates[1], loc.coordinates[0]] as [number, number]);
    const centerLng = lngLats.reduce((s, p) => s + p[0], 0) / lngLats.length;
    const centerLat = lngLats.reduce((s, p) => s + p[1], 0) / lngLats.length;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [centerLng, centerLat],
      zoom: 4,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      geolocations.forEach((loc) => {
        const el = document.createElement("div");
        el.className = "investigation-map-marker";
        el.innerHTML = `
          <div style="
            width: 24px; height: 24px;
            background: hsl(var(--primary));
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
          "></div>
        `;

        const popup = new mapboxgl.Popup({ offset: 20, closeButton: true })
          .setHTML(
            `<div style="padding: 8px; max-width: 260px; font-family: inherit;">
              <div style="font-weight: 600; margin-bottom: 4px; color:rgb(12, 14, 16);">${escapeHtml(loc.entity)}</div>
              <div style="font-size: 12px; color:rgb(12, 14, 16); line-height: 1.4;">${escapeHtml(loc.context)}</div>
              <div style="margin-top: 6px; font-size: 11px; color: #64748b;">${loc.coordinates[0].toFixed(4)}, ${loc.coordinates[1].toFixed(4)}</div>
            </div>`
          );

        const marker = new mapboxgl.Marker(el)
          .setLngLat([loc.coordinates[1], loc.coordinates[0]])
          .setPopup(popup)
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, [geolocations]);

  return <div ref={mapContainer} className="h-[320px] w-full rounded-md overflow-hidden border border-border" />;
};
