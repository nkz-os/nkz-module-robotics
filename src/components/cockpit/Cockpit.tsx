import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Inline, MetricCard, MetricGrid, Stack } from '@nekazari/ui-kit';
import { ArrowLeft } from 'lucide-react';
import { useRobotStream } from '../../hooks/useRobotStream';
import { heartbeatKey, linkKey, num } from '../../lib/format';
import { EstopButton } from '../EstopButton';

/** Observe + E-Stop. The platform sends no motion commands: the robot accepts none from the cloud. */
export const Cockpit: React.FC<{ uuid: string; name: string; onBack: () => void }> = ({ uuid, name, onBack }) => {
  const { t } = useTranslation('robotics');
  const { live, linkUp } = useRobotStream(uuid);
  const tel = live?.telemetry ?? null;
  const hb = heartbeatKey(live);

  return (
    <Stack gap="section">
      <Inline justify="between" align="center" wrap>
        <Inline gap="stack" align="center">
          <Button variant="ghost" onClick={onBack} leadingIcon={<ArrowLeft size={16} />}>{t('cockpit.back')}</Button>
          <Stack gap="tight">
            <span className="text-nkz-xl font-semibold text-nkz-text-primary">{name}</span>
            <span className="text-nkz-xs font-mono text-nkz-text-secondary break-all">{uuid}</span>
          </Stack>
        </Inline>
        <EstopButton uuid={uuid} live={live} />
      </Inline>

      <Inline gap="inline" wrap>
        <Badge intent={linkUp === false ? 'negative' : 'default'}>{t(linkKey(linkUp))}</Badge>
        <Badge intent={live?.online ? 'positive' : 'warning'}>{t(hb.key, { n: 'n' in hb ? hb.n : 0 })}</Badge>
        {live?.mode && <Badge intent={live.mode === 'ESTOP' ? 'negative' : 'info'}>{t(`mode.${live.mode}`)}</Badge>}
      </Inline>

      <MetricGrid>
        <MetricCard label={t('cockpit.battery')} value={`${num(tel?.battery_pct, 0)} %`} />
        <MetricCard label={t('cockpit.speed')} value={`${num(tel?.speed_kmh, 1)} km/h`} />
        <MetricCard label={t('cockpit.heading')} value={`${num(tel?.heading_deg, 0)}°`} />
        <MetricCard label={t('cockpit.position')} value={`${num(tel?.lat, 5)}, ${num(tel?.lon, 5)}`} />
      </MetricGrid>

      <Card padding="md">
        <span className="text-nkz-sm text-nkz-text-secondary">{t('cockpit.scope')}</span>
      </Card>
    </Stack>
  );
};
