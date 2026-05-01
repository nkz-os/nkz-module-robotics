import React, { useEffect, useRef } from 'react';
import type { RobotInfo } from '../../types/robotics';

interface FleetMapProps {
  robots: RobotInfo[];
  onSelectRobot?: (id: string) => void;
}

const FleetMap: React.FC<FleetMapProps> = ({ robots, onSelectRobot }) => {
  const containerRef = useRef<HTMLDivElement>(null);

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

    robots.forEach(robot => {
      if (robot.location?.coordinates) {
        const [lon, lat] = robot.location.coordinates;
        viewer.entities.add({
          id: robot.id,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          point: {
            pixelSize: 12,
            color: robot.operationMode === 'AUTO' ? Cesium.Color.LIME : Cesium.Color.DODGERBLUE,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
          },
          label: {
            text: robot.name || robot.id,
            font: '12px Inter, sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -16),
          },
        });
      }
    });

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
  }, [robots, onSelectRobot]);

  return <div ref={containerRef} className="w-full h-96 rounded-xl overflow-hidden border border-slate-700" />;
};

export default FleetMap;
