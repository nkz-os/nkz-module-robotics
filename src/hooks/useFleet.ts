import { useCallback, useEffect, useState } from 'react';
import { ApiError, roboticsApi } from '../services/roboticsApi';
import type { FleetOut } from '../types/robotics';

/** Fleet list, refreshed every 5 s (live state lives in the backend). */
export function useFleet() {
  const [data, setData] = useState<FleetOut | null>(null);
  const [error, setError] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      roboticsApi
        .listRobots()
        .then((d) => {
          if (!cancelled) {
            setData(d);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof ApiError ? e.status : 0);
        });
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, refresh };
}
