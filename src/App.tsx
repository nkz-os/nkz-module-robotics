import './i18n';
import React from 'react';
import RoboticsCockpit from './components/RoboticsCockpit';
import './index.css';

// Export slots for Module Federation
export { viewerSlots } from './slots';

// Main App Component
const RoboticsApp: React.FC = () => {
  return (
    <div className="robotics-module min-h-screen bg-slate-900 text-slate-100">
      <RoboticsCockpit />
    </div>
  );
};

export default RoboticsApp;
