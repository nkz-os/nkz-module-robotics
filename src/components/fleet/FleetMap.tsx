import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RobotInfo } from '../../types/robotics';

interface FleetMapProps {
  robots: RobotInfo[];
  onSelectRobot?: (id: string) => void;
  routeGeometry?: any;
  onViewerReady?: (map: L.Map) => void;
}

const STATUS_COLORS: Record<string, string> = {
  AUTO: '#10B981',
  MANUAL: '#F59E0B',
  MONITOR: '#3B82F6',
  ESTOP: '#EF4444',
};

function robotColor(robot: RobotInfo): string {
  return STATUS_COLORS[robot.operationMode] || STATUS_COLORS.MONITOR;
}

function createArrowIcon(color: string, headingDeg: number): L.DivIcon {
  const svg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
       style="transform:rotate(${headingDeg}deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">
       <polygon points="12,0 24,20 12,14 0,20" fill="${color}" stroke="white" stroke-width="1.5"/></svg>`;
  return L.divIcon({ html: svg, iconSize: [24, 24], iconAnchor: [12, 12], className: '' });
}

const FleetMap: React.FC<FleetMapProps> = ({ robots, onSelectRobot, routeGeometry, onViewerReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const routeLineRef = useRef<L.Polyline | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [42.5, -2.0],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    // ESRI satellite — free, no token, global coverage
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri',
    }).addTo(map);
    markersLayerRef.current.addTo(map);
    mapRef.current = map;
    if (onViewerReady) onViewerReady(map);

    // Fix tiles rendering at wrong scale — Leaflet needs a size recalculation
    // after the container gets its final dimensions in the flex/grid layout.
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      markersLayerRef.current.remove();
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when robots change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersLayerRef.current.clearLayers();

    robots.forEach(robot => {
      if (!robot.location?.coordinates) return;
      const [lon, lat] = robot.location.coordinates;
      const color = robotColor(robot);
      const heading = (robot as any).heading_deg ?? 0;

      const marker = L.marker([lat, lon], { icon: createArrowIcon(color, heading) })
        .bindTooltip(robot.name || robot.id, { direction: 'top', offset: [0, -18] });

      if (onSelectRobot) marker.on('click', () => onSelectRobot(robot.id));
      markersLayerRef.current.addLayer(marker);
    });

    if (markersLayerRef.current.getLayers().length > 0) {
      const group = L.featureGroup(markersLayerRef.current.getLayers() as L.Layer[]);
      map.fitBounds(group.getBounds(), { padding: [30, 30], maxZoom: 15 });
    }
  }, [robots, onSelectRobot]);

  // Update route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (routeLineRef.current) { map.removeLayer(routeLineRef.current); routeLineRef.current = null; }

    if (routeGeometry?.type === 'LineString' && routeGeometry.coordinates?.length > 1) {
      const latlngs = routeGeometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
      routeLineRef.current = L.polyline(latlngs, { color: '#F59E0B', weight: 3, opacity: 0.8 }).addTo(map);
      map.fitBounds(routeLineRef.current.getBounds(), { padding: [20, 20] });
    }
  }, [routeGeometry]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-slate-700"
      style={{ background: '#1e293b', height: '400px', minHeight: '400px' }}
    />
  );
};

export default FleetMap;
