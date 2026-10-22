import { useEffect, useRef, useState } from 'react';
import { roboticsApi } from '../services/roboticsApi';
import type { RobotTelemetry } from '../types/robotics';

export function useRoboticsSSE(robotId: string | null) {
  const [telemetry, setTelemetry] = useState<RobotTelemetry | null>(null);
  const [connected, setConnected] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!robotId) {
      setTelemetry(null);
      setConnected(false);
      return;
    }

    setConnected(false);
    cleanupRef.current = roboticsApi.streamTelemetry(
      robotId,
      (data) => {
        if (!data.error) {
          setTelemetry(data);
          setConnected(true);
        }
      },
      () => setConnected(false),
    );

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [robotId]);

  return { telemetry, connected };
}
