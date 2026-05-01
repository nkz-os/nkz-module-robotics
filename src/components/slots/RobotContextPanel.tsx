import React, { useEffect, useState } from 'react';
import { Battery, Activity, Crosshair } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { roboticsApi } from '../../services/roboticsApi';
import type { RobotInfo } from '../../types/robotics';

interface RobotContextPanelProps {
  entityId?: string | null;
  entityType?: string;
}

const RobotContextPanel: React.FC<RobotContextPanelProps> = ({ entityId: propEntityId, entityType: propEntityType }) => {
  const { t } = useTranslation('robotics');
  const [robot, setRobot] = useState<RobotInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [entityId, setEntityId] = useState<string | null>(propEntityId ?? null);

  // Listen for entity selection events from the host
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ entityId: string | null; type?: string }>).detail;
      if (detail && detail.type === 'AgriRobot') {
        setEntityId(detail.entityId);
      } else if (!detail || !detail.entityId) {
        setEntityId(null);
        setRobot(null);
      }
    };

    window.addEventListener('nekazari:entity-selected', handler);
    return () => window.removeEventListener('nekazari:entity-selected', handler);
  }, []);

  // Also accept props (for direct slot injection without events)
  useEffect(() => {
    if (propEntityId && propEntityType === 'AgriRobot') {
      setEntityId(propEntityId);
    }
  }, [propEntityId, propEntityType]);

  // Fetch robot when entityId changes
  useEffect(() => {
    if (!entityId) {
      setRobot(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    roboticsApi.getRobot(entityId)
      .then(data => {
        if (!cancelled) setRobot(data);
      })
      .catch(() => {
        if (!cancelled) setRobot(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [entityId]);

  const openCockpit = () => {
    if (entityId) {
      // Navigate to the module's cockpit view
      window.location.hash = `/robotics/${entityId}`;
    }
  };

  if (!entityId || entityId === 'null') return null;
  if (loading) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        <div className="w-5 h-5 border-2 border-slate-600 border-t-rose-500 rounded-full animate-spin mx-auto mb-2" />
        Loading...
      </div>
    );
  }
  if (!robot) return null;

  const batteryPct = robot.battery ?? 0;
  const batteryStatus = batteryPct > 40 ? 'ok' : batteryPct > 15 ? 'warning' : 'critical';
  const mode = robot.operationMode || 'MONITOR';
  const modeColor =
    mode === 'AUTO' ? 'text-emerald-400' :
    mode === 'MANUAL' ? 'text-amber-400' :
    'text-blue-400';

  return (
    <div className="bg-slate-800/90 backdrop-blur-md border border-slate-700/50 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white truncate">{robot.name || robot.id}</h3>
        <span className={`text-xs font-bold ${modeColor}`}>{mode}</span>
      </div>

      {/* Battery bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span className="flex items-center gap-1"><Battery size={12} /> {t('fleet.battery')}</span>
          <span className="tabular-nums">{batteryPct}%</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              batteryStatus === 'critical' ? 'bg-red-500' : batteryStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${batteryPct}%` }}
          />
        </div>
      </div>

      {/* GPS */}
      {robot.location && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Crosshair size={12} className="text-slate-500" />
          <span className="tabular-nums font-mono">
            {robot.location.coordinates[1].toFixed(5)}, {robot.location.coordinates[0].toFixed(5)}
          </span>
        </div>
      )}

      {/* Last seen */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Activity size={12} className="text-slate-500" />
        <span>{robot.dateModified ? new Date(robot.dateModified).toLocaleTimeString() : '—'}</span>
      </div>

      {/* Open cockpit button */}
      <button
        onClick={openCockpit}
        className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors"
      >
        {t('fleet.openCockpit')}
      </button>
    </div>
  );
};

export default RobotContextPanel;
