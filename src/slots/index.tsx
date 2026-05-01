import React from 'react';
import '../i18n';

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
  'map-layer': [],
  'layer-toggle': [],
  'context-panel': [],
  'bottom-panel': [],
  'entity-tree': [],
};

export const viewerSlots = moduleSlots;
export default moduleSlots;
