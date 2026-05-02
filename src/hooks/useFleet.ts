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

  const provision = useCallback(async (body: {
    name: string;
    robot_id: string;
    robot_type?: string;
    parcel_id?: string | null;
    device_uuid: string;
    claim_code: string;
  }) => {
    const result = await roboticsApi.provisionRobot(body);
    await refresh();
    return result;
  }, [refresh]);

  return { robots, selected, selectRobot, refresh, loading, provision };
}
