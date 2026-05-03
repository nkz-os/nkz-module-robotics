import './i18n';
import React, { useState, useCallback } from 'react';
import FleetDashboard from './components/fleet/FleetDashboard';
import CockpitLayout from './components/cockpit/CockpitLayout';

const RoboticsApp: React.FC = () => {
  const [view, setView] = useState<'fleet' | 'cockpit'>('fleet');
  const [activeRobotId, setActiveRobotId] = useState<string | null>(null);

  const openCockpit = useCallback((robotId: string) => {
    setActiveRobotId(robotId);
    setView('cockpit');
  }, []);

  const backToFleet = useCallback(() => {
    setActiveRobotId(null);
    setView('fleet');
  }, []);

  if (view === 'cockpit' && activeRobotId) {
    return (
      <div className="robotics-module min-h-screen">
        <CockpitLayout robotId={activeRobotId} onBack={backToFleet} />
      </div>
    );
  }

  return (
    <div className="robotics-module min-h-screen">
      <FleetDashboard onOpenCockpit={openCockpit} />
    </div>
  );
};

export default RoboticsApp;
