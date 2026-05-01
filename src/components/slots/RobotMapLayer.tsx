import React, { useEffect, useRef } from 'react';
import { roboticsApi } from '../../services/roboticsApi';
import type { RobotInfo } from '../../types/robotics';

interface RobotMapLayerProps {
  viewer?: any; // Cesium.Viewer from host
  visible?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  AUTO: '#10B981',      // green
  MANUAL: '#F59E0B',    // amber
  MONITOR: '#3B82F6',   // blue
  ESTOP: '#EF4444',     // red
  OFFLINE: '#6B7280',   // gray
};

function robotColor(robot: RobotInfo): string {
  if (robot.operationMode === 'AUTO') return STATUS_COLORS.AUTO;
  if (robot.operationMode === 'MANUAL') return STATUS_COLORS.MANUAL;
  return STATUS_COLORS.MONITOR;
}

const RobotMapLayer: React.FC<RobotMapLayerProps> = ({ viewer, visible = true }) => {
  const entitiesRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<number>(0);

  useEffect(() => {
    const Cesium = (window as any).Cesium;
    if (!Cesium || !viewer || viewer.isDestroyed() || !visible) return;

    const fetchAndRender = async () => {
      try {
        const data = await roboticsApi.listRobots();
        const currentIds = new Set<string>();

        data.robots.forEach((robot: RobotInfo) => {
          if (!robot.location?.coordinates) return;
          currentIds.add(robot.id);

          const [lon, lat] = robot.location.coordinates;
          const color = robotColor(robot);
          const heading = (robot as any).heading_deg ?? 0;

          // Remove existing entity for this robot if present
          if (entitiesRef.current.has(robot.id)) {
            const existing = viewer.entities.getById(robot.id);
            if (existing) viewer.entities.remove(existing);
          }

          // Add directional marker (arrow rotated by heading)
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
              scale: 0.9,
            },
            properties: {
              robotId: robot.id,
              operationMode: robot.operationMode,
              battery: robot.battery,
            },
          });
        });

        // Remove entities for robots no longer in list
        entitiesRef.current.forEach(id => {
          if (!currentIds.has(id)) {
            const existing = viewer.entities.getById(id);
            if (existing) viewer.entities.remove(existing);
          }
        });
        entitiesRef.current = currentIds;
      } catch (err) {
        console.warn('[RobotMapLayer] fetch error:', err);
      }
    };

    // Creates a directional arrow as a canvas image for Cesium billboard
    function createArrowCanvas(color: string, headingDeg: number): HTMLCanvasElement {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      ctx.save();
      ctx.translate(size / 2, size / 2);
      // Convert heading (0=North, clockwise) to canvas rotation
      ctx.rotate(((headingDeg - 90) * Math.PI) / 180);

      // Draw arrow shape
      ctx.beginPath();
      ctx.moveTo(0, -size / 2 + 2);        // tip
      ctx.lineTo(size / 2 - 4, size / 4);  // right wing
      ctx.lineTo(0, size / 6);             // indent
      ctx.lineTo(-size / 2 + 4, size / 4); // left wing
      ctx.closePath();

      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();
      return canvas;
    }

    fetchAndRender();

    // Poll every 5 seconds for updates (complement to SSE for fleet-wide view)
    intervalRef.current = window.setInterval(fetchAndRender, 5000);

    return () => {
      clearInterval(intervalRef.current);
      // Clean up all robot entities from host viewer
      entitiesRef.current.forEach(id => {
        const existing = viewer?.entities?.getById(id);
        if (existing && !viewer.isDestroyed()) viewer.entities.remove(existing);
      });
      entitiesRef.current.clear();
    };
  }, [viewer, visible]);

  return null; // No DOM output — renders directly to Cesium
};

export default RobotMapLayer;
