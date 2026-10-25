import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card, Inline, Spinner, Stack } from '@nekazari/ui-kit';
import { ApiError, roboticsApi } from '../../services/roboticsApi';
import type { EnrollOut } from '../../types/robotics';
import { robotConfig } from '../../lib/format';

interface Props {
  uuid: string;
  name: string;
  mode: 'enroll' | 'rotate';
  onClose: () => void;
}

/** Enroll (or rotate) a robot's Zenoh credential: shown once, then the router config is applied. */
export const EnrollRobot: React.FC<Props> = ({ uuid, name, mode, onClose }) => {
  const { t } = useTranslation('robotics');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<EnrollOut | null>(null);
  const [state, setState] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!issued || state === 'active' || state === 'failed') return;
    const timer = window.setInterval(async () => {
      try {
        setState((await roboticsApi.enrollment(uuid)).state);
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [issued, state, uuid]);

  const run = async () => {
    setBusy(true);
    setErrorKey(null);
    try {
      const out = mode === 'enroll' ? await roboticsApi.enroll(uuid) : await roboticsApi.rotate(uuid);
      setIssued(out);
      setState(out.state);
    } catch (e: unknown) {
      const s = e instanceof ApiError ? e.status : 0;
      setErrorKey([404, 409, 502].includes(s) ? `enroll.error.${s}` : 'enroll.error.generic');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="lg">
      <Stack gap="stack">
        <span className="text-nkz-lg font-semibold text-nkz-text-primary">
          {t(mode === 'enroll' ? 'enroll.title' : 'enroll.rotateTitle', { name })}
        </span>
        {!issued && <span className="text-nkz-sm text-nkz-text-secondary">{t(`enroll.explain.${mode}`)}</span>}
        {issued && (
          <Stack gap="inline">
            <span className="text-nkz-sm font-semibold text-nkz-text-primary">{t('enroll.passwordOnce')}</span>
            <code className="text-nkz-sm font-mono break-all">{issued.zenoh.password}</code>
            <span className="text-nkz-sm text-nkz-text-secondary">{t('enroll.robotSettings')}</span>
            <pre className="text-nkz-xs font-mono break-all whitespace-pre-wrap">{robotConfig(issued.zenoh)}</pre>
            <Inline gap="inline" align="center">
              {state !== 'active' && state !== 'failed' && <Spinner size="sm" />}
              <Badge intent={state === 'active' ? 'positive' : state === 'failed' ? 'negative' : 'warning'}>
                {t(`enrollment.${state ?? 'applying'}`)}
              </Badge>
            </Inline>
          </Stack>
        )}
        {errorKey && <span className="text-nkz-sm text-nkz-danger">{t(errorKey)}</span>}
        <Inline justify="end" gap="inline">
          <Button variant="ghost" onClick={onClose}>{issued ? t('common.close') : t('common.cancel')}</Button>
          {!issued && <Button loading={busy} disabled={busy} onClick={run}>{t(`enroll.confirm.${mode}`)}</Button>}
        </Inline>
      </Stack>
    </Card>
  );
};
