import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Inline, Stack } from '@nekazari/ui-kit';
import { OctagonX } from 'lucide-react';
import { ApiError, roboticsApi } from '../services/roboticsApi';
import type { EstopOut, LiveState } from '../types/robotics';
import { estopView } from '../lib/format';

/** Two-step E-Stop for one robot. Shown as done only when the robot reports ESTOP. */
export const EstopButton: React.FC<{ uuid: string; live: LiveState | null }> = ({ uuid, live }) => {
  const { t } = useTranslation('robotics');
  const [arming, setArming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EstopOut | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setErrorKey(null);
    try {
      setResult(await roboticsApi.estop(uuid));
    } catch (e: unknown) {
      setErrorKey(e instanceof ApiError && e.status === 503 ? 'estop.linkDown' : 'estop.failed');
    } finally {
      setBusy(false);
      setArming(false);
    }
  };

  const view = estopView(result, live);
  return (
    <Stack gap="tight">
      {arming ? (
        <Inline gap="inline">
          <Button variant="danger" loading={busy} onClick={send} leadingIcon={<OctagonX size={16} />}>
            {t('estop.confirm')}
          </Button>
          <Button variant="ghost" onClick={() => setArming(false)}>{t('estop.cancel')}</Button>
        </Inline>
      ) : (
        <Button variant="danger" onClick={() => setArming(true)} leadingIcon={<OctagonX size={16} />}>
          {t('estop.button')}
        </Button>
      )}
      {view !== 'idle' && <span className="text-nkz-xs text-nkz-text-secondary">{t(`estop.${view}`)}</span>}
      {errorKey && <span className="text-nkz-xs text-nkz-danger">{t(errorKey)}</span>}
    </Stack>
  );
};
