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
  description: 'Robotics cockpit and telemetry — Nekazari Platform Module',
  accent: { base: '#DC2626', soft: '#FEE2E2', strong: '#991B1B' },
  icon: 'bot',
  main: MainPage,
  api: { basePath: '/api/robotics' },
  slots: moduleSlots as never,
});
