import { useEffect, useRef, useState, useCallback } from 'react';
import { roboticsApi } from '../services/roboticsApi';

export function useRoboticsWS(robotId: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [videoFrame, setVideoFrame] = useState<{ cameraId: number; data: ArrayBuffer } | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);

  useEffect(() => {
    if (!robotId) return;

    const ws = roboticsApi.connectControl(robotId);
    wsRef.current = ws;
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        const view = new DataView(e.data);
        const cameraId = view.getUint32(0, true);
        const frame = e.data.slice(4);
        setVideoFrame({ cameraId, data: frame });
      } else {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'pong') setLatencyMs(msg.latency_ms);
        } catch { /* skip */ }
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
      wsRef.current = null;
    };
  }, [robotId]);

  const sendCommand = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { sendCommand, videoFrame, connected, latencyMs };
}
