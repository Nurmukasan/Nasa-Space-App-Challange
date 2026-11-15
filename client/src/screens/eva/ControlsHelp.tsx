import { t } from '../../i18n';

const ROWS: [keys: string, label: string][] = [
  ['WASD', 'controls.move'],
  ['SHIFT', 'controls.run'],
  ['SPACE', 'controls.dig'],
  ['E', 'controls.interact'],
  ['1–5', 'controls.radio'],
  ['TAB', 'controls.console'],
  ['Z X C', 'controls.classify'],
  ['ESC', 'controls.menu'],
];

/** Everything the old bottom hint line used to say, kept in the Esc menu where it cannot nag. */
export function ControlsHelp() {
  return (
    <section className="controls-help" aria-label={t('controls.title')}>
      <h2>{t('controls.title')}</h2>
      <dl>
        {ROWS.map(([keys, label]) => (
          <div key={label}>
            <dt>{keys}</dt>
            <dd>{t(label)}</dd>
          </div>
        ))}
      </dl>
      <p>{t('controls.tip')}</p>
    </section>
  );
}
