import React from 'react';
import '../i18n';
import RobotMapLayer from '../components/slots/RobotMapLayer';
import RobotContextPanel from '../components/slots/RobotContextPanel';

const MODULE_ID = 'robotics';

export interface SlotWidgetDefinition {
  id: string;
  moduleId: string;
  component: string;
  priority: number;
  localComponent: React.ComponentType<any>;
  showWhen?: { entityType?: string[] };
}

export type SlotType = 'layer-toggle' | 'context-panel' | 'bottom-panel' | 'entity-tree' | 'map-layer';

export interface ModuleViewerSlots {
  'layer-toggle'?: SlotWidgetDefinition[];
  'context-panel'?: SlotWidgetDefinition[];
  'bottom-panel'?: SlotWidgetDefinition[];
  'entity-tree'?: SlotWidgetDefinition[];
  'map-layer'?: SlotWidgetDefinition[];
  moduleProvider?: React.ComponentType<{ children: React.ReactNode }>;
}

export const moduleSlots: ModuleViewerSlots = {
  'map-layer': [
    {
      id: `${MODULE_ID}-map-layer`,
      moduleId: MODULE_ID,
      component: 'RobotMapLayer',
      priority: 20,
      localComponent: RobotMapLayer,
      showWhen: { entityType: ['AgriRobot'] },
    },
  ],
  'layer-toggle': [],
  'context-panel': [
    {
      id: `${MODULE_ID}-context-panel`,
      moduleId: MODULE_ID,
      component: 'RobotContextPanel',
      priority: 10,
      localComponent: RobotContextPanel,
      showWhen: { entityType: ['AgriRobot'] },
    },
  ],
  'bottom-panel': [],
  'entity-tree': [],
};

export const viewerSlots = moduleSlots;
export default moduleSlots;
