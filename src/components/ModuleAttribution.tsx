import { useTranslation } from 'react-i18next';

/** FIWARE / NKZ / AGPL attribution for the module page and slot panels (AGENTS.md). */
export function ModuleAttribution() {
  const { t } = useTranslation('robotics');
  return (
    <p className="text-nkz-xs text-nkz-muted mt-2 pt-2 border-t border-nkz-border/50">
      {t('attribution.platform')}
    </p>
  );
}
