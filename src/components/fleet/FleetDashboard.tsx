import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@nekazari/sdk';
import { Badge, Button, Card, EmptyState, Inline, Spinner, Stack } from '@nekazari/ui-kit';
import { Bot, KeyRound, OctagonX, Trash2 } from 'lucide-react';
import { useFleet } from '../../hooks/useFleet';
import { ApiError, roboticsApi } from '../../services/roboticsApi';
import type { FleetRobot } from '../../types/robotics';
import { heartbeatKey } from '../../lib/format';
import { EnrollRobot } from './EnrollRobot';

interface Props {
  onOpen: (robot: FleetRobot) => void;
}

export const FleetDashboard: React.FC<Props> = ({ onOpen }) => {
  const { t } = useTranslation('robotics');
  const auth = useAuth();
  const isAdmin = auth.hasAnyRole(['TenantAdmin', 'PlatformAdmin']);
  const { data, error, refresh } = useFleet();
  const [enrolling, setEnrolling] = useState<{ robot: FleetRobot; mode: 'enroll' | 'rotate' } | null>(null);
  const [arming, setArming] = useState(false);
  const [allResult, setAllResult] = useState<string | null>(null);

  const estopAll = async () => {
    setArming(false);
    try {
      const r = await roboticsApi.estopAll();
      setAllResult(t('fleet.estopAllResult', { sent: r.results.length, failed: r.failed.length }));
    } catch (e: unknown) {
      setAllResult(t(e instanceof ApiError && e.status === 503 ? 'estop.linkDown' : 'estop.failed'));
    }
  };

  const unenroll = async (robot: FleetRobot) => {
    await roboticsApi.unenroll(robot.device_uuid).catch(() => undefined);
    refresh();
  };

  return (
    <Stack gap="section">
      <Inline justify="between" align="center" wrap>
        <Inline gap="stack" align="center">
          <Bot size={24} />
          <Stack gap="tight">
            <span className="text-nkz-xl font-semibold text-nkz-text-primary">{t('fleet.title')}</span>
            <span className="text-nkz-sm text-nkz-text-secondary">{t('fleet.subtitle')}</span>
          </Stack>
        </Inline>
        <Inline gap="inline" align="center">
          {data && !data.link_up && <Badge intent="negative">{t('live.linkDown')}</Badge>}
          {arming ? (
            <>
              <Button variant="danger" onClick={estopAll} leadingIcon={<OctagonX size={16} />}>
                {t('fleet.estopAllConfirm')}
              </Button>
              <Button variant="ghost" onClick={() => setArming(false)}>{t('estop.cancel')}</Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setArming(true)} leadingIcon={<OctagonX size={16} />}>
              {t('fleet.estopAll')}
            </Button>
          )}
        </Inline>
      </Inline>
      {allResult && <span className="text-nkz-sm text-nkz-text-secondary">{allResult}</span>}

      {enrolling && (
        <EnrollRobot uuid={enrolling.robot.device_uuid} name={enrolling.robot.name} mode={enrolling.mode}
          onClose={() => {
            setEnrolling(null);
            refresh();
          }} />
      )}

      {!data && error === null && <Spinner />}
      {error !== null && <EmptyState title={t('fleet.loadError')}
        action={<Button variant="secondary" onClick={refresh}>{t('common.retry')}</Button>} />}
      {data && data.robots.length === 0 && <EmptyState title={t('fleet.empty')} description={t('fleet.emptyHint')} />}

      {data && data.robots.length > 0 && (
        <Stack gap="inline">
          {data.robots.map((robot) => {
            const hb = heartbeatKey(robot.live);
            return (
              <Card key={robot.device_uuid} padding="sm">
                <Inline justify="between" align="center" wrap>
                  <Stack gap="tight">
                    <span className="text-nkz-sm font-semibold text-nkz-text-primary">{robot.name}</span>
                    <span className="text-nkz-xs font-mono text-nkz-text-secondary break-all">{robot.device_uuid}</span>
                  </Stack>
                  <Inline gap="inline" align="center" wrap>
                    {robot.enrollment ? (
                      <Badge intent={robot.enrollment.state === 'active' ? 'positive' : 'warning'}>
                        {t(`enrollment.${robot.enrollment.state}`)}
                      </Badge>
                    ) : (
                      <Badge>{t('enrollment.none')}</Badge>
                    )}
                    {robot.enrollment && (
                      <Badge intent={robot.live?.online ? 'positive' : 'default'}>{t(hb.key, { n: 'n' in hb ? hb.n : 0 })}</Badge>
                    )}
                    {robot.live?.mode && <Badge intent="info">{t(`mode.${robot.live.mode}`)}</Badge>}
                    {robot.enrollment && <Button size="sm" onClick={() => onOpen(robot)}>{t('fleet.open')}</Button>}
                    {isAdmin && !robot.enrollment && (
                      <Button size="sm" variant="secondary" onClick={() => setEnrolling({ robot, mode: 'enroll' })}>
                        {t('fleet.enroll')}
                      </Button>
                    )}
                    {isAdmin && robot.enrollment && (
                      <>
                        <Button size="sm" variant="ghost" leadingIcon={<KeyRound size={14} />}
                          onClick={() => setEnrolling({ robot, mode: 'rotate' })}>{t('fleet.rotate')}</Button>
                        <Button size="sm" variant="ghost" leadingIcon={<Trash2 size={14} />}
                          onClick={() => unenroll(robot)}>{t('fleet.unenroll')}</Button>
                      </>
                    )}
                  </Inline>
                </Inline>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};
