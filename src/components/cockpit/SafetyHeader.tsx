import React, { useState, useCallback } from 'react';
import { AlertTriangle, Battery, Activity, Gamepad2 } from 'lucide-react';
import { useTranslation } from '@nekazari/sdk';
import type { OperationMode } from '../../types/robotics';

interface SafetyHeaderProps {
  mode: OperationMode;
  onModeChange: (mode: OperationMode) => void;
  onEStop: () => void;
  batteryPct: number;
  latencyMs: number;
  gamepadConnected: boolean;
}

const MODES: OperationMode[] = ['MONITOR', 'MANUAL', 'AUTO'];

const SafetyHeader: React.FC<SafetyHeaderProps> = ({
  mode, onModeChange, onEStop, batteryPct, latencyMs, gamepadConnected,
}) => {
  const { t } = useTranslation('robotics');
  const [estopPending, setEstopPending] = useState(false);

  const handleEStop = useCallback(() => {
    if (estopPending) {
      onEStop();
      setEstopPending(false);
    } else {
      setEstopPending(true);
      setTimeout(() => setEstopPending(false), 3000);
    }
  }, [estopPending, onEStop]);

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800 shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <span className={`block h-3 w-3 rounded-full ${latencyMs > 300 ? 'bg-[color:var(--nkz-critical)] animate-ping' : 'bg-[color:var(--nkz-ok)]'}`} />
          <span className="font-mono text-sm font-bold text-slate-200 tracking-wider">
            {t('cockpit.latencyMs', { ms: latencyMs })}
          </span>
        </div>

        <div className="h-8 w-px bg-slate-800" />

        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800" role="radiogroup" aria-label="Operation mode">
          {MODES.map(m => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => onModeChange(m)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${
                mode === m
                  ? m === 'MANUAL' ? 'bg-[color:var(--nkz-warning)] text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                  : m === 'AUTO' ? 'bg-[color:var(--nkz-ok)] text-white shadow-[0_0_15px_rgba(5,150,105,0.5)]'
                  : 'bg-[color:var(--nkz-info)] text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t(`cockpit.mode${m}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Activity size={14} className="text-blue-400" />
          <span>{t('cockpit.latencyMs', { ms: latencyMs })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Battery size={14} className={batteryPct < 20 ? 'text-red-400' : 'text-emerald-400'} />
          <span>{t('cockpit.batteryPercent', { pct: batteryPct })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Gamepad2 size={14} className={gamepadConnected ? 'text-emerald-400' : 'text-slate-600'} />
          <span>{gamepadConnected ? t('cockpit.gamepadConnected') : t('cockpit.gamepadDisconnected')}</span>
        </div>

        <button
          onClick={handleEStop}
          aria-label={estopPending ? t('cockpit.eStopConfirm') : t('cockpit.eStop')}
          className={`font-black px-6 py-2 rounded transition-all active:scale-95 ${
            estopPending
              ? 'bg-red-400 text-black animate-pulse'
              : 'bg-[color:var(--nkz-critical)] hover:bg-[color:var(--nkz-critical)] text-white shadow-[0_0_20px_rgba(225,29,72,0.4)]'
          }`}
        >
          <span className="flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>{estopPending ? t('cockpit.eStopConfirm') : t('cockpit.eStop')}</span>
          </span>
        </button>
      </div>
    </header>
  );
};

export default SafetyHeader;
