import React from 'react';
import { useTranslation } from '@nekazari/sdk';

interface ImplementPanelProps {
  implementType: string | null;
  implementData: Record<string, number>;
}

const ImplementPanel: React.FC<ImplementPanelProps> = ({ implementType, implementData }) => {
  const { t } = useTranslation('robotics');

  if (!implementType) {
    return (
      <div className="p-5 flex flex-col">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('implement.title')}</h3>
        <p className="text-xs text-slate-600">{t('implement.noImplement')}</p>
      </div>
    );
  }

  const isSprayer = implementType.toLowerCase().includes('spray');

  return (
    <div className="p-5 flex flex-col">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">{t('implement.title')}</h3>
      <div className="space-y-4">
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-300">{implementType}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ACTIVE</span>
          </div>

          {isSprayer ? (
            <>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{t('implement.sprayerPressure')}</span>
                <span>{implementData.pressure?.toFixed(1) ?? '—'} {t('implement.sprayerPressureUnit')}</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1 mb-2">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.min((implementData.pressure || 0) / 5 * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{t('implement.sprayerFlow')}</span>
                <span>{implementData.flow_rate?.toFixed(1) ?? '—'} {t('implement.sprayerFlowUnit')}</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-blue-500" style={{ width: `${Math.min((implementData.flow_rate || 0) / 30 * 100, 100)}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{t('implement.seederRate')}</span>
                <span>{implementData.seed_rate?.toFixed(1) ?? '—'} {t('implement.seederRateUnit')}</span>
              </div>
            </>
          )}
        </div>
        <button className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 uppercase tracking-wider rounded transition-colors">
          {t('implement.configParams')}
        </button>
      </div>
    </div>
  );
};

export default ImplementPanel;
