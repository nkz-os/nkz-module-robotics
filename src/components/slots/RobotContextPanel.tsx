import React, { useEffect, useState } from 'react';
import { Battery, Activity, Crosshair } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import { SlotShellCompact } from '@nekazari/viewer-kit';
import { Badge, Spinner, Button } from '@nekazari/ui-kit';
import { roboticsApi } from '../../services/roboticsApi';
import type { RobotInfo } from '../../types/robotics';

const roboticsAccent = { base: '#3B82F6', soft: '#DBEAFE', strong: '#1D4ED8' };

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
      window.location.hash = `/robotics/${entityId}`;
    }
  };

  if (!entityId || entityId === 'null') return null;
  if (loading) {
    return (
      <SlotShellCompact moduleId="robotics" accent={roboticsAccent}>
        <div className="flex items-center justify-center gap-2 py-nkz-stack">
          <Spinner size="sm" />
          <span className="text-nkz-sm text-nkz-text-secondary">{t('fleet.loading')}</span>
        </div>
      </SlotShellCompact>
    );
  }
  if (!robot) return null;

  const batteryPct = robot.battery ?? 0;
  const batteryStatus = batteryPct > 40 ? 'ok' : batteryPct > 15 ? 'warning' : 'critical';
  const mode = robot.operationMode || 'MONITOR';
  const modeColor =
    mode === 'AUTO' ? 'text-nkz-success' :
    mode === 'MANUAL' ? 'text-nkz-warning' :
    'text-nkz-info';

  return (
    <SlotShellCompact moduleId="robotics" accent={roboticsAccent}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-nkz-sm font-semibold text-nkz-text-primary truncate">{robot.name || robot.id}</h3>
        <Badge intent={mode === 'AUTO' ? 'positive' : mode === 'MANUAL' ? 'warning' : 'info'} size="sm">
          {mode}
        </Badge>
      </div>

      {/* Battery bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-nkz-xs text-nkz-text-muted mb-1">
          <span className="flex items-center gap-1"><Battery size={12} /> {t('fleet.battery')}</span>
          <span className="tabular-nums">{batteryPct}%</span>
        </div>
        <div className="h-1.5 bg-nkz-surface-sunken rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              batteryStatus === 'critical' ? 'bg-nkz-danger' : batteryStatus === 'warning' ? 'bg-nkz-warning' : 'bg-nkz-success'
            }`}
            style={{ width: `${batteryPct}%` }}
          />
        </div>
      </div>

      {/* GPS */}
      {robot.location && (
        <div className="flex items-center gap-2 text-nkz-xs text-nkz-text-muted mb-1">
          <Crosshair size={12} className="text-nkz-text-muted" />
          <span className="tabular-nums font-mono">
            {robot.location.coordinates[1].toFixed(5)}, {robot.location.coordinates[0].toFixed(5)}
          </span>
        </div>
      )}

      {/* Last seen */}
      <div className="flex items-center gap-2 text-nkz-xs text-nkz-text-muted mb-2">
        <Activity size={12} className="text-nkz-text-muted" />
        <span>{robot.dateModified ? new Date(robot.dateModified).toLocaleTimeString() : '—'}</span>
      </div>

      {/* Open cockpit button */}
      <Button
        variant="primary"
        size="sm"
        onClick={openCockpit}
        className="w-full"
      >
        {t('fleet.openCockpit')}
      </Button>
    </SlotShellCompact>
  );
};

export default RobotContextPanel;
