import React, { useState, useCallback } from 'react';
import { Play, Pause, Download, Loader2 } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { roboticsApi } from '../../services/roboticsApi';

interface RouteHistoryProps {
  robotId: string | null;
  onRouteLoaded?: (geometry: any) => void;
}

const RouteHistory: React.FC<RouteHistoryProps> = ({ robotId, onRouteLoaded }) => {
  const { t } = useTranslation('robotics');
  const [loading, setLoading] = useState(false);
  const [geometry, setGeometry] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadRoute = useCallback(async () => {
    if (!robotId) return;
    setLoading(true);
    try {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const result = await roboticsApi.getRoute(robotId, start, end, 5000);
      setGeometry(result.geometry);
      onRouteLoaded?.(result.geometry);
    } catch (err) {
      console.warn('[RouteHistory] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [robotId, onRouteLoaded]);

  const handlePlayPause = () => {
    if (!geometry) {
      loadRoute().then(() => setPlaying(true));
    } else {
      setPlaying(!playing);
    }
  };

  const handleExport = () => {
    if (!geometry) return;
    const geojson = {
      type: 'Feature',
      geometry,
      properties: { robot_id: robotId, timestamp: new Date().toISOString() },
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-${robotId}-${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('fleet.routeHistory')}</h3>

      {!robotId ? (
        <p className="text-xs text-slate-500">Select a robot to view route history.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlayPause}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={handleExport}
              disabled={!geometry}
              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors disabled:opacity-50"
              title={t('fleet.routeExport')}
            >
              <Download size={14} />
            </button>
            <input
              type="range"
              className="flex-1 accent-rose-500"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
            />
            <span className="text-xs text-slate-500 tabular-nums w-8">{progress}%</span>
          </div>
          {geometry && (
            <p className="text-[10px] text-slate-500">
              {geometry.type}: {geometry.coordinates?.length || 0} points loaded
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RouteHistory;
