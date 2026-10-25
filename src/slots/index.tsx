/**
 * Host slots: a context panel with live state and E-Stop when a robot
 * (ManufacturingMachine, category robot) is selected in the viewer. The robot's
 * position on the map comes from its twin's `location`, drawn by the host.
 */
import '../i18n';
import type { ModuleViewerSlots } from '@nekazari/sdk';
import RobotContextPanel from '../components/slots/RobotContextPanel';

const MODULE_ID = 'robotics';

export const moduleSlots: ModuleViewerSlots = {
  'map-layer': [],
  'layer-toggle': [],
  'context-panel': [
    {
      id: 'robotics-context-panel',
      moduleId: MODULE_ID,
      component: 'RobotContextPanel',
      priority: 10,
      localComponent: RobotContextPanel,
      showWhen: { entityType: ['ManufacturingMachine'] },
    },
  ],
  'bottom-panel': [],
  'entity-tree': [],
};

export default moduleSlots;
