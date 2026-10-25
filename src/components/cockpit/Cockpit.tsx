import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Inline, MetricCard, MetricGrid, Stack } from '@nekazari/ui-kit';
import { ArrowLeft } from 'lucide-react';
import { useRobotStream } from '../../hooks/useRobotStream';
import { heartbeatKey } from '../../lib/format';
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
        <EstopButton uuid={uuid} mode={live?.mode ?? null} />
      </Inline>

      <Inline gap="inline" wrap>
        <Badge intent={linkUp === false ? 'negative' : 'default'}>
          {linkUp === false ? t('live.linkDown') : t('live.linkUp')}
        </Badge>
        <Badge intent={live?.online ? 'positive' : 'warning'}>{t(hb.key, { n: 'n' in hb ? hb.n : 0 })}</Badge>
        {live?.mode && <Badge intent={live.mode === 'ESTOP' ? 'negative' : 'info'}>{t(`mode.${live.mode}`)}</Badge>}
      </Inline>

      <MetricGrid>
        <MetricCard label={t('cockpit.battery')} value={tel ? `${Math.round(tel.battery_pct)} %` : '—'} />
        <MetricCard label={t('cockpit.speed')} value={tel ? `${tel.speed_kmh.toFixed(1)} km/h` : '—'} />
        <MetricCard label={t('cockpit.heading')} value={tel ? `${Math.round(tel.heading_deg)}°` : '—'} />
        <MetricCard label={t('cockpit.position')}
          value={tel ? `${tel.lat.toFixed(5)}, ${tel.lon.toFixed(5)}` : '—'} />
      </MetricGrid>

      <Card padding="md">
        <span className="text-nkz-sm text-nkz-text-secondary">{t('cockpit.scope')}</span>
      </Card>
    </Stack>
  );
};
