import { useEffect, useState } from 'react';
import { streamUrl } from '../services/roboticsApi';
import type { LiveState } from '../types/robotics';

/** Live state of one robot over Server-Sent Events (cookie-authenticated). */
export function useRobotStream(uuid: string) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [linkUp, setLinkUp] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource(streamUrl(uuid), { withCredentials: true });
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false); // EventSource reconnects by itself
    es.addEventListener('state', (e) => {
      try {
        setLive(JSON.parse((e as MessageEvent).data) as LiveState);
      } catch {
        /* malformed frame: keep the last good state */
      }
    });
    es.addEventListener('link', (e) => {
      try {
        setLinkUp((JSON.parse((e as MessageEvent).data) as { state: string }).state === 'up');
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [uuid]);

  return { live, linkUp, connected };
}
