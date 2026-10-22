import React from 'react';
import { Battery, Clock } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { StatusBadge } from '../shared/StatusBadge';
import type { RobotInfo } from '../../types/robotics';

interface FleetTableProps {
  robots: RobotInfo[];
  onOpenCockpit: (id: string) => void;
}

const modeStatus: Record<string, 'ok' | 'warning' | 'critical' | 'info' | 'offline'> = {
  AUTO: 'ok',
  MANUAL: 'warning',
  MONITOR: 'info',
  ESTOP: 'critical',
};

function gpsStatus(location: RobotInfo['location']): string {
  if (!location?.coordinates) return '—';
  const [lon, lat] = location.coordinates;
  if (lon === 0 && lat === 0) return 'No fix';
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

const FleetTable: React.FC<FleetTableProps> = ({ robots, onOpenCockpit }) => {
  const { t } = useTranslation('robotics');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
          <tr>
            <th className="px-4 py-3">ID</th>
            <th className="px-4 py-3">{t('fleet.mode')}</th>
            <th className="px-4 py-3">{t('fleet.battery')}</th>
            <th className="px-4 py-3">{t('fleet.gpsFix')}</th>
            <th className="px-4 py-3">{t('fleet.lastSeen')}</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {robots.map(robot => {
            const batteryPct = robot.battery ?? 0;
            const batteryStatus = batteryPct > 40 ? 'ok' : batteryPct > 15 ? 'warning' : 'critical';
            const mode = robot.operationMode || 'MONITOR';

            return (
              <tr
                key={robot.id}
                className="hover:bg-slate-800/30 cursor-pointer transition-colors"
                onClick={() => onOpenCockpit(robot.id)}
              >
                <td className="px-4 py-3 font-mono text-white text-xs">{robot.name || robot.id}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={modeStatus[mode] || 'info'} label={mode} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Battery size={12} className={batteryStatus === 'critical' ? 'text-red-400' : batteryStatus === 'warning' ? 'text-amber-400' : 'text-emerald-400'} />
                    <div className="w-16 h-1 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          batteryStatus === 'critical' ? 'bg-red-500' : batteryStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${batteryPct}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-slate-400 w-8">{batteryPct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-slate-400 font-mono tabular-nums">{gpsStatus(robot.location)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock size={10} />
                    <span>{robot.dateModified ? new Date(robot.dateModified).toLocaleTimeString() : '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenCockpit(robot.id); }}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-medium rounded transition-colors"
                  >
                    {t('fleet.openCockpit')}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FleetTable;
