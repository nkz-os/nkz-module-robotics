import React from 'react';
import { useTranslation } from 'react-i18next';
import { useViewer } from '@nekazari/sdk';
import { Badge, Inline, Stack } from '@nekazari/ui-kit';
import { SlotShell } from '@nekazari/viewer-kit';
import { useRobotStream } from '../../hooks/useRobotStream';
import { heartbeatKey } from '../../lib/format';
import { EstopButton } from '../EstopButton';
import { ModuleAttribution } from '../ModuleAttribution';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RobotLive: React.FC<{ uuid: string }> = ({ uuid }) => {
  const { t } = useTranslation('robotics');
  const { live } = useRobotStream(uuid);
  const hb = heartbeatKey(live);
  return (
    <Stack gap="inline">
      <Inline gap="inline" wrap>
        <Badge intent={live?.online ? 'positive' : 'default'}>{t(hb.key, { n: 'n' in hb ? hb.n : 0 })}</Badge>
        {live?.mode && <Badge intent="info">{t(`mode.${live.mode}`)}</Badge>}
        {live?.telemetry && <Badge>{`${Math.round(live.telemetry.battery_pct)} %`}</Badge>}
      </Inline>
      <EstopButton uuid={uuid} mode={live?.mode ?? null} />
    </Stack>
  );
};

/** Live state and E-Stop for the robot selected in the viewer. */
const RobotContextPanel: React.FC = () => {
  const { t } = useTranslation('robotics');
  const { selectedEntityId } = useViewer();
  const uuid = selectedEntityId?.split(':').pop() ?? '';
  return (
    <SlotShell moduleId="robotics" title={t('context.title')}>
      {UUID_RE.test(uuid) ? <RobotLive uuid={uuid.toLowerCase()} /> :
        <span className="text-nkz-xs text-nkz-muted">{t('context.notRobot')}</span>}
      <ModuleAttribution />
    </SlotShell>
  );
};

export default RobotContextPanel;
