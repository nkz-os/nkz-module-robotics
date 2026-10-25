/**
 * defineModule() is the runtime source of truth: every publish overwrites the
 * marketplace row with the manifest emitted from it (roles, route, version).
 */
import { defineModule } from '@nekazari/module-kit';
import { lazy } from 'react';
import './i18n';
import { moduleSlots } from './slots';
import pkg from '../package.json';

const MainPage = lazy(() => import('./App'));

export default defineModule({
  id: 'robotics',
  displayName: 'Robotics',
  version: pkg.version,
  hostApiVersion: '^2.0.0',
  description: 'Fleet view, live robot state and E-Stop over the platform VPN',
  accent: { base: '#DC2626', soft: '#FEE2E2', strong: '#991B1B' },
  icon: 'bot',
  main: MainPage,
  route: '/robotics',
  requiredRoles: ['Farmer', 'TechnicalConsultant', 'TenantAdmin', 'PlatformAdmin'],
  api: { basePath: '/api/robotics' },
  data: { entities: ['ManufacturingMachine'], timeseries: [] },
  slots: moduleSlots as never,
});
