import { useState, useEffect, useCallback } from 'react';
import { roboticsApi } from '../services/roboticsApi';
import type { RobotInfo } from '../types/robotics';

export function useFleet() {
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await roboticsApi.listRobots();
      setRobots(data.robots);
    } catch (err) {
      console.error('[useFleet] refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const selectRobot = useCallback((id: string | null) => setSelected(id), []);

  return { robots, selected, selectRobot, refresh, loading };
}
