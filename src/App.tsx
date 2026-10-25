import './i18n';
import React, { useState } from 'react';
import { ModuleAttribution } from './components/ModuleAttribution';
import { Cockpit } from './components/cockpit/Cockpit';
import { FleetDashboard } from './components/fleet/FleetDashboard';
import type { FleetRobot } from './types/robotics';

const App: React.FC = () => {
  const [open, setOpen] = useState<FleetRobot | null>(null);
  return (
    <div className="w-full p-nkz-section">
      {open ? (
        <Cockpit uuid={open.device_uuid} name={open.name} onBack={() => setOpen(null)} />
      ) : (
        <FleetDashboard onOpen={setOpen} />
      )}
      <ModuleAttribution />
    </div>
  );
};

export default App;
