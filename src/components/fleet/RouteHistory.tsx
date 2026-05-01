import React, { useState } from 'react';
import { Play, Pause, Download } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { roboticsApi } from '../../services/roboticsApi';

interface RouteHistoryProps {
  robotId: string | null;
}

const RouteHistory: React.FC<RouteHistoryProps> = ({ robotId }) => {
  const { t } = useTranslation('robotics');
  const [playing, setPlaying] = useState(false);
  const [geometry, setGeometry] = useState<any>(null);

  const loadRoute = async () => {
    if (!robotId) return;
    const result = await roboticsApi.getRoute(robotId);
    setGeometry(result.geometry);
  };

  if (!robotId) {
    return <div className="text-xs text-slate-500 p-4">{t('fleet.routeHistory')}</div>;
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-slate-300 mb-3">{t('fleet.routeHistory')}</h3>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setPlaying(!playing); if (!geometry) loadRoute(); }}
          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition-colors">
          <Download size={14} />
        </button>
        <input type="range" className="flex-1 accent-rose-500" min={0} max={100} defaultValue={0} />
      </div>
    </div>
  );
};

export default RouteHistory;
