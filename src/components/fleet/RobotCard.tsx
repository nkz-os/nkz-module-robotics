import React from 'react';
import { Battery, Wifi, Navigation } from 'lucide-react';
import { StatusBadge } from '../shared/StatusBadge';
import type { RobotInfo } from '../../types/robotics';

interface RobotCardProps {
  robot: RobotInfo;
  onOpenCockpit: (id: string) => void;
}

const modeStatus: Record<string, 'ok' | 'warning' | 'info' | 'offline'> = {
  MONITOR: 'info',
  MANUAL: 'warning',
  AUTO: 'ok',
};

const RobotCard: React.FC<RobotCardProps> = ({ robot, onOpenCockpit }) => {
  const batteryPct = robot.battery ?? 0;
  const batteryStatus: 'ok' | 'warning' | 'critical' =
    batteryPct > 40 ? 'ok' : batteryPct > 15 ? 'warning' : 'critical';
  const mode = robot.operationMode || 'MONITOR';

  return (
    <div
      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600 transition-colors cursor-pointer"
      onClick={() => onOpenCockpit(robot.id)}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white truncate">{robot.name || robot.id}</h3>
        <StatusBadge status={modeStatus[mode] || 'info'} label={mode} />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Battery size={14} className={batteryStatus === 'critical' ? 'text-red-400' : 'text-emerald-400'} />
          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${batteryStatus === 'critical' ? 'bg-red-500' : batteryStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${batteryPct}%` }}
            />
          </div>
          <span className="text-xs tabular-nums w-10 text-right">{batteryPct}%</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <Wifi size={14} className="text-blue-400" />
          <span className="text-xs">{robot.location ? `${robot.location.coordinates[1].toFixed(4)}, ${robot.location.coordinates[0].toFixed(4)}` : '—'}</span>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <Navigation size={14} className="text-slate-500" />
          <span className="text-xs">{robot.dateModified ? new Date(robot.dateModified).toLocaleTimeString() : '—'}</span>
        </div>
      </div>
    </div>
  );
};

export default RobotCard;
