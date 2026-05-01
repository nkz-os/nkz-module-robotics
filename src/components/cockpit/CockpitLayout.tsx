import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useHMI } from '@nekazari/ui-kit';
import { useRoboticsSSE } from '../../hooks/useRoboticsSSE';
import { useRoboticsWS } from '../../hooks/useRoboticsWS';
import { useGamepad } from '../../hooks/useGamepad';
import SafetyHeader from './SafetyHeader';
import VideoViewport from './VideoViewport';
import TelemetryHUD from './TelemetryHUD';
import DrivePanel from './DrivePanel';
import ImplementPanel from './ImplementPanel';
import MiniMap from './MiniMap';
import type { OperationMode, DriveMode } from '../../types/robotics';

interface CockpitLayoutProps {
  robotId: string;
  onBack: () => void;
}

const CockpitLayout: React.FC<CockpitLayoutProps> = ({ robotId, onBack }) => {
  const { isHmiMode } = useHMI();

  const [opMode, setOpMode] = useState<OperationMode>('MONITOR');
  const [driveMode, setDriveMode] = useState<DriveMode>('ACKERMANN_FRONT');
  const [batteryPct, setBatteryPct] = useState(0);

  const { telemetry } = useRoboticsSSE(robotId);
  const { sendCommand, videoFrame, latencyMs } = useRoboticsWS(robotId);
  const gamepad = useGamepad();

  useEffect(() => {
    if (telemetry) setBatteryPct(telemetry.battery_pct ?? 0);
  }, [telemetry]);

  // Gamepad → cmd_vel mapping
  const opModeRef = useRef(opMode);
  opModeRef.current = opMode;

  useEffect(() => {
    if (!gamepad.connected || opModeRef.current !== 'MANUAL') return;
    const linearX = -(gamepad.axes[1] || 0);
    const angularZ = gamepad.axes[0] || 0;
    sendCommand({
      type: 'cmd_vel',
      linear: { x: linearX, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: angularZ },
    });
  }, [gamepad.axes, gamepad.connected, sendCommand]);

  // Gamepad Start button → E-STOP
  useEffect(() => {
    if (gamepad.connected && gamepad.buttons[9]?.pressed) {
      sendCommand({ type: 'estop' });
    }
  }, [gamepad.buttons, gamepad.connected, sendCommand]);

  const handleCmdVel = useCallback((linearX: number, angularZ: number) => {
    sendCommand({
      type: 'cmd_vel',
      linear: { x: linearX, y: 0, z: 0 },
      angular: { x: 0, y: 0, z: angularZ },
    });
  }, [sendCommand]);

  const handleModeChange = useCallback((mode: OperationMode) => {
    setOpMode(mode);
    sendCommand({ type: 'mode', value: mode });
  }, [sendCommand]);

  const onEStop = useCallback(() => {
    sendCommand({ type: 'estop' });
  }, [sendCommand]);

  return (
    <div className={`h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden ${isHmiMode ? 'hmi-mode' : ''}`}>
      <div className="flex items-center gap-2 px-6 py-2 bg-slate-900 border-b border-slate-800">
        <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={18} />
        </button>
        <span className="text-xs text-slate-500 font-mono">{robotId}</span>
      </div>

      <SafetyHeader
        mode={opMode}
        onModeChange={handleModeChange}
        onEStop={onEStop}
        batteryPct={batteryPct}
        latencyMs={latencyMs}
        gamepadConnected={gamepad.connected}
      />

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <VideoViewport videoFrame={videoFrame} mode={opMode} />
          <TelemetryHUD telemetry={telemetry} />
        </div>
      </main>

      <footer className="h-48 bg-slate-900 border-t border-slate-800 grid grid-cols-12 divide-x divide-slate-800">
        <div className="col-span-3">
          <DrivePanel
            driveMode={driveMode}
            onDriveModeChange={setDriveMode}
            onCmdVel={handleCmdVel}
            opMode={opMode}
          />
        </div>
        <div className="col-span-6">
          <MiniMap lat={telemetry?.lat ?? null} lon={telemetry?.lon ?? null} />
        </div>
        <div className="col-span-3">
          <ImplementPanel implementType="Sprayer" implementData={{ pressure: 2.4, flow_rate: 12 }} />
        </div>
      </footer>
    </div>
  );
};

export default CockpitLayout;
