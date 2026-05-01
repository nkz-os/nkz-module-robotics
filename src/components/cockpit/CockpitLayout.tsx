import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useHMI } from '@nekazari/ui-kit';
import { useRoboticsSSE } from '../../hooks/useRoboticsSSE';
import { useRoboticsWS } from '../../hooks/useRoboticsWS';
import { useGamepad } from '../../hooks/useGamepad';
import { roboticsApi } from '../../services/roboticsApi';
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
  const [controlOwner, setControlOwner] = useState<string | null>(null);
  const [controlBlocked, setControlBlocked] = useState(false);
  const [latencyLockout, setLatencyLockout] = useState(false);
  const highLatencyTimerRef = useRef<number>(0);
  const LATENCY_THRESHOLD = 200; // ms
  const LATENCY_GRACE_MS = 2000;  // 2 seconds

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
    const linearX = Math.max(-MAX_LINEAR, Math.min(MAX_LINEAR, -(gamepad.axes[1] || 0)));
    const angularZ = Math.max(-MAX_ANGULAR, Math.min(MAX_ANGULAR, gamepad.axes[0] || 0));
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

  // Latency watchdog — lockout controls on sustained high latency
  useEffect(() => {
    if (latencyMs > LATENCY_THRESHOLD && opMode === 'MANUAL') {
      if (!highLatencyTimerRef.current) {
        highLatencyTimerRef.current = window.setTimeout(() => {
          setLatencyLockout(true);
          // Force MONITOR mode and stop
          setOpMode('MONITOR');
          sendCommand({ type: 'mode', value: 'MONITOR' });
          sendCommand({ type: 'estop' });
        }, LATENCY_GRACE_MS);
      }
    } else {
      if (highLatencyTimerRef.current) {
        clearTimeout(highLatencyTimerRef.current);
        highLatencyTimerRef.current = 0;
      }
    }
    return () => {
      if (highLatencyTimerRef.current) {
        clearTimeout(highLatencyTimerRef.current);
        highLatencyTimerRef.current = 0;
      }
    };
  }, [latencyMs, opMode, sendCommand]);

  const MAX_LINEAR = 1.0;   // m/s
  const MAX_ANGULAR = 1.0;  // rad/s

  const handleCmdVel = useCallback((linearX: number, angularZ: number) => {
    sendCommand({
      type: 'cmd_vel',
      linear: { x: Math.max(-MAX_LINEAR, Math.min(MAX_LINEAR, linearX)), y: 0, z: 0 },
      angular: { x: 0, y: 0, z: Math.max(-MAX_ANGULAR, Math.min(MAX_ANGULAR, angularZ)) },
    });
  }, [sendCommand]);

  const handleModeChange = useCallback(async (mode: OperationMode) => {
    if (mode === 'MANUAL') {
      try {
        // Try to claim control
        await roboticsApi.claimControl(robotId);
        setControlBlocked(false);
        setControlOwner(null);
      } catch (err: any) {
        // 409 = someone else has control
        if (err.message?.includes('409') || err.message?.includes('under control')) {
          setControlOwner(err.message);
          setControlBlocked(true);
          return;
        }
        // Other errors — proceed anyway
      }
    } else {
      // Release control when leaving MANUAL
      try {
        await roboticsApi.releaseControl(robotId);
      } catch { /* best effort */ }
      setControlBlocked(false);
      setControlOwner(null);
    }

    setOpMode(mode);
    sendCommand({ type: 'mode', value: mode });
  }, [robotId, sendCommand]);

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

      {controlBlocked && (
        <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center space-y-4 p-8 bg-slate-900 rounded-xl border border-amber-500/30">
            <h2 className="text-amber-400 text-lg font-bold">Robot bajo control</h2>
            <p className="text-slate-300 text-sm">
              {controlOwner
                ? `El robot está siendo teleoperado por ${controlOwner}`
                : 'Otro operador tiene el control de este robot'}
            </p>
            <p className="text-slate-500 text-xs">Solo un operador puede controlar el robot a la vez.</p>
            <button
              onClick={() => setControlBlocked(false)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
            >
              Volver a MONITOR
            </button>
          </div>
        </div>
      )}

      {latencyLockout && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center space-y-4 p-8">
            <div className="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center mx-auto animate-pulse">
              <span className="text-red-500 text-2xl font-black">!</span>
            </div>
            <h2 className="text-red-500 text-xl font-bold">Control bloqueado</h2>
            <p className="text-slate-300 text-sm max-w-md">
              Latencia excesiva detectada ({latencyMs}ms). El control ha sido desactivado por seguridad.
              El robot ha pasado a modo MONITOR.
            </p>
            <button
              onClick={() => setLatencyLockout(false)}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
            >
              Reconectar y reactivar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CockpitLayout;
