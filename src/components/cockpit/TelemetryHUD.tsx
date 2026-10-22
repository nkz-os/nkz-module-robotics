import React from 'react';
import { Satellite } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import type { RobotTelemetry } from '../../types/robotics';

interface TelemetryHUDProps {
  telemetry: RobotTelemetry | null;
}

const TelemetryHUD: React.FC<TelemetryHUDProps> = ({ telemetry }) => {
  const { t } = useTranslation('robotics');
  if (!telemetry) return null;

  return (
    <div className="absolute top-6 left-6 p-4 rounded-r-lg border-l-4 border-blue-500 bg-slate-900/60 backdrop-blur-sm font-mono text-xs text-blue-100 space-y-2">
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudLinX')}</span>
        <span className="text-white tabular-nums">{telemetry.lin_x?.toFixed(2) ?? '—'} {t('cockpit.hudLinUnit')}</span>
      </div>
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudAngZ')}</span>
        <span className="text-white tabular-nums">{telemetry.ang_z?.toFixed(2) ?? '—'} {t('cockpit.hudAngUnit')}</span>
      </div>
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudHead')}</span>
        <span className="text-white tabular-nums">{t('cockpit.hudDeg', { deg: telemetry.heading_deg?.toFixed(0) ?? '—' })}</span>
      </div>
      <div className="flex justify-between w-44">
        <span>{t('cockpit.hudSpeed')}</span>
        <span className="text-white tabular-nums">{telemetry.speed_kmh?.toFixed(1) ?? '—'} {t('cockpit.hudSpeedUnit')}</span>
      </div>
      <div className="flex justify-between w-44 text-[10px] text-slate-400">
        <span>{t('cockpit.hudLat')}</span>
        <span className="tabular-nums">{telemetry.lat?.toFixed(6) ?? '—'}</span>
      </div>
      <div className="flex justify-between w-44 text-[10px] text-slate-400">
        <span>{t('cockpit.hudLon')}</span>
        <span className="tabular-nums">{telemetry.lon?.toFixed(6) ?? '—'}</span>
      </div>
      <div className="flex justify-between w-44 text-[10px]">
        <span className="text-slate-400 flex items-center gap-1"><Satellite size={10} /></span>
        <span className={`tabular-nums font-medium ${
          (telemetry as any).gnss_quality === 'RTK_FIX' ? 'text-emerald-400' :
          (telemetry as any).gnss_quality === 'RTK_FLOAT' ? 'text-amber-400' :
          (telemetry as any).gnss_quality === 'DGPS' ? 'text-blue-400' :
          'text-red-400'
        }`}>{(telemetry as any).gnss_quality || 'NO_FIX'}</span>
      </div>
    </div>
  );
};

export default TelemetryHUD;
