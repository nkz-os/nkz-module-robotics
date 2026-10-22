import React from 'react';
import { useTranslation } from '@nekazari/sdk';
import Joystick from '../shared/Joystick';
import type { DriveMode, OperationMode } from '../../types/robotics';

interface DrivePanelProps {
  driveMode: DriveMode;
  onDriveModeChange: (mode: DriveMode) => void;
  onCmdVel: (linearX: number, angularZ: number) => void;
  opMode: OperationMode;
}

const DRIVE_MODES: { id: DriveMode; icon: string }[] = [
  { id: 'ACKERMANN_FRONT', icon: '🚗' },
  { id: 'ACKERMANN_DUAL', icon: '🚙' },
  { id: 'CRAB', icon: '🦀' },
  { id: 'DIFFERENTIAL', icon: '🚜' },
];

const DrivePanel: React.FC<DrivePanelProps> = ({ driveMode, onDriveModeChange, onCmdVel, opMode }) => {
  const { t } = useTranslation('robotics');
  const disabled = opMode !== 'MANUAL';

  const modeKey = (id: DriveMode): string => {
    if (id === 'ACKERMANN_FRONT') return 'front';
    if (id === 'ACKERMANN_DUAL') return 'dual';
    if (id === 'CRAB') return 'crab';
    return 'pivot';
  };

  return (
    <div className="p-5 flex flex-col gap-4">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('drive.title')}</h3>
      <div className="grid grid-cols-2 gap-2">
        {DRIVE_MODES.map(({ id, icon }) => (
          <button
            key={id}
            onClick={() => onDriveModeChange(id)}
            disabled={disabled}
            className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
              driveMode === id
                ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                : 'bg-slate-800/30 border-slate-700/50 text-slate-500 hover:bg-slate-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span className="text-xl">{icon}</span>
            <span className="text-[10px] font-bold text-white uppercase">{t(`drive.${modeKey(id)}`)}</span>
            <span className="text-[9px] opacity-70">{t(`drive.${modeKey(id)}Sub`)}</span>
          </button>
        ))}
      </div>
      <div className="flex justify-center mt-2">
        <Joystick onMove={onCmdVel} disabled={disabled} />
      </div>
      {disabled && <p className="text-[10px] text-slate-500 text-center">{t('drive.joystickHint')}</p>}
    </div>
  );
};

export default DrivePanel;
