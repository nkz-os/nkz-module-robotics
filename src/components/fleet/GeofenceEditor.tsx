import React, { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import type { Geofence } from '../../types/robotics';

interface GeofenceEditorProps {
  geofences: Geofence[];
  activeGeofenceId?: string | null;
  onStartDrawing: () => void;
  onSaveCurrent: (name: string, type: 'inclusion' | 'exclusion', coordinates: number[][][]) => void;
  onCancelDrawing: () => void;
  onDelete: (id: string) => void;
  onSelectGeofence: (id: string | null) => void;
  drawing: boolean;
  cesiumViewer?: any;  // NEW
}

const GeofenceEditor: React.FC<GeofenceEditorProps> = ({
  geofences,
  activeGeofenceId,
  onStartDrawing,
  onSaveCurrent,
  onCancelDrawing,
  onDelete,
  onSelectGeofence,
  drawing,
  cesiumViewer,
}) => {
  const { t } = useTranslation('robotics');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'inclusion' | 'exclusion'>('inclusion');

  // Cesium drawing state
  const pointsRef = useRef<number[][]>([]);
  const polylineRef = useRef<any>(null);
  const handlerRef = useRef<any>(null);

  useEffect(() => {
    const Cesium = (window as any).Cesium;
    if (!Cesium || !cesiumViewer || cesiumViewer.isDestroyed()) return;

    if (drawing) {
      // Start drawing mode — collect points on LEFT_CLICK
      pointsRef.current = [];

      handlerRef.current = new Cesium.ScreenSpaceEventHandler(cesiumViewer.scene.canvas);
      handlerRef.current.setInputAction((click: any) => {
        const cartesian = cesiumViewer.scene.pickPosition(click.position);
        if (!Cesium.defined(cartesian)) return;

        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        pointsRef.current.push([lon, lat]);

        // Update or create polyline preview
        if (polylineRef.current) {
          cesiumViewer.entities.remove(polylineRef.current);
        }

        if (pointsRef.current.length > 1) {
          polylineRef.current = cesiumViewer.entities.add({
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(
                pointsRef.current.flat()
              ),
              width: 3,
              material: new Cesium.PolylineDashMaterialProperty({
                color: Cesium.Color.YELLOW,
              }),
              clampToGround: true,
            },
          });
        }

        // Add point marker
        cesiumViewer.entities.add({
          position: cartesian,
          point: {
            pixelSize: 8,
            color: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
          },
        });
      }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    } else {
      // Cleanup drawing mode
      if (handlerRef.current) {
        handlerRef.current.destroy();
        handlerRef.current = null;
      }
      if (polylineRef.current && cesiumViewer && !cesiumViewer.isDestroyed()) {
        cesiumViewer.entities.remove(polylineRef.current);
        polylineRef.current = null;
      }
    }

    return () => {
      if (handlerRef.current) handlerRef.current.destroy();
      if (polylineRef.current && cesiumViewer && !cesiumViewer.isDestroyed()) {
        cesiumViewer.entities.remove(polylineRef.current);
      }
    };
  }, [drawing, cesiumViewer]);

  const handleSave = () => {
    if (newName.trim() && pointsRef.current.length >= 3) {
      // Close the polygon by adding first point at the end
      const closed = [...pointsRef.current, pointsRef.current[0]];
      onSaveCurrent(newName.trim(), newType, [closed]);
      setNewName('');
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-300">{t('fleet.geofences')}</h3>

      {!drawing ? (
        <button
          onClick={onStartDrawing}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          {t('fleet.drawGeofence')}
        </button>
      ) : (
        <div className="space-y-2 p-3 bg-slate-700/30 rounded-lg">
          <input
            type="text"
            placeholder={t('fleet.geofenceName')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNewType('inclusion')}
              className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                newType === 'inclusion'
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {t('fleet.geofenceInclusion')}
            </button>
            <button
              onClick={() => setNewType('exclusion')}
              className={`flex-1 px-2 py-1 text-xs rounded border transition-colors ${
                newType === 'exclusion'
                  ? 'bg-red-500/20 border-red-500/30 text-red-400'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              {t('fleet.geofenceExclusion')}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!newName.trim() || pointsRef.current.length < 3}
              className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
            >
              <Check size={12} />
              {t('fleet.saveGeofence')}
            </button>
            <button
              onClick={onCancelDrawing}
              className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {geofences.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {geofences.map(fence => (
            <div
              key={fence.id}
              onClick={() => onSelectGeofence(fence.id === activeGeofenceId ? null : fence.id)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                fence.id === activeGeofenceId
                  ? 'bg-blue-500/20 border border-blue-500/30'
                  : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${fence.type === 'inclusion' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-slate-300 truncate max-w-[120px]">{fence.name}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(fence.id); }}
                className="text-slate-500 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GeofenceEditor;
