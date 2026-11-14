import { t } from '../../i18n';
export function Reveal({ reveal }: { reveal: string | null }) {
  if (!reveal) return null;
  const key = `reportUi.${reveal}`,
    text = t(key);
  return (
    <section className="panel report-reveal">
      <h2 className="panel-title">{t('reportUi.reveal')}</h2>
      <p>{text === key ? t('reportUi.reveal.common') : text}</p>
      <small>{t('reportUi.reveal.note')}</small>
    </section>
  );
}
