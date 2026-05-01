import React, { useEffect, useRef } from 'react';
import type { RobotInfo } from '../../types/robotics';

interface FleetMapProps {
  robots: RobotInfo[];
  onSelectRobot?: (id: string) => void;
  routeGeometry?: any; // GeoJSON geometry for route overlay
}

const STATUS_COLORS: Record<string, string> = {
  AUTO: '#10B981',
  MANUAL: '#F59E0B',
  MONITOR: '#3B82F6',
};

function robotColor(robot: RobotInfo): string {
  if (robot.operationMode === 'AUTO') return STATUS_COLORS.AUTO;
  if (robot.operationMode === 'MANUAL') return STATUS_COLORS.MANUAL;
  return STATUS_COLORS.MONITOR;
}

function createArrowCanvas(color: string, headingDeg: number): HTMLCanvasElement {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(((headingDeg - 90) * Math.PI) / 180);

  ctx.beginPath();
  ctx.moveTo(0, -size / 2 + 2);
  ctx.lineTo(size / 2 - 4, size / 4);
  ctx.lineTo(0, size / 6);
  ctx.lineTo(-size / 2 + 4, size / 4);
  ctx.closePath();

  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  return canvas;
}

const FleetMap: React.FC<FleetMapProps> = ({ robots, onSelectRobot, routeGeometry }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);

  useEffect(() => {
    const Cesium = (window as any).Cesium;
    if (!Cesium || !containerRef.current) return;

    const viewer = new Cesium.Viewer(containerRef.current, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      navigationHelpButton: false,
      sceneModePicker: false,
    });
    viewerRef.current = viewer;

    robots.forEach(robot => {
      if (!robot.location?.coordinates) return;
      const [lon, lat] = robot.location.coordinates;
      const color = robotColor(robot);
      const heading = (robot as any).heading_deg ?? 0;

      viewer.entities.add({
        id: robot.id,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
          image: createArrowCanvas(color, heading),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          scale: 0.8,
        },
        label: {
          text: robot.name || robot.id,
          font: '11px Inter, sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -20),
        },
      });
    });

    // Render route geometry if provided
    if (routeGeometry && routeGeometry.type === 'LineString') {
      const coords = routeGeometry.coordinates.map((c: number[]) =>
        Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] || 0)
      );
      viewer.entities.add({
        id: 'route-polyline',
        polyline: {
          positions: coords,
          width: 3,
          material: Cesium.Color.fromCssColorString('#F59E0B'),
          clampToGround: true,
        },
      });
    }

    viewer.flyTo(viewer.entities);

    if (onSelectRobot) {
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((click: any) => {
        const picked = viewer.scene.pick(click.position);
        if (picked?.id?.id && onSelectRobot) {
          onSelectRobot(picked.id.id);
        }
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      return () => {
        handler.destroy();
        viewer.destroy();
      };
    }

    return () => viewer.destroy();
  }, [robots, onSelectRobot, routeGeometry]);

  return <div ref={containerRef} className="w-full h-96 rounded-xl overflow-hidden border border-slate-700" />;
};

export default FleetMap;
