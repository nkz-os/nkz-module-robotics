import React, { useState } from 'react';
import { Search, Plus, Layers } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { useFleet } from '../../hooks/useFleet';
import RobotCard from './RobotCard';

interface FleetDashboardProps {
  onOpenCockpit: (id: string) => void;
}

const FleetDashboard: React.FC<FleetDashboardProps> = ({ onOpenCockpit }) => {
  const { t } = useTranslation('robotics');
  const { robots, loading, refresh } = useFleet();
  const [search, setSearch] = useState('');

  const filtered = robots.filter(r =>
    (r.name || r.id).toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="text-rose-500" />
          {t('fleet.title')}
        </h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={t('fleet.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 w-56"
            />
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            {t('fleet.registerRobot')}
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Layers size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">{t('fleet.noRobots')}</p>
          <p className="text-sm mt-2">{t('fleet.noRobotsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(robot => (
            <RobotCard key={robot.id} robot={robot} onOpenCockpit={onOpenCockpit} />
          ))}
        </div>
      )}
    </div>
  );
};

export default FleetDashboard;
