import type { ModuleDef } from '@rs/shared';
import { t } from '../../i18n';
import { PixelIcon } from '../../ui/PixelIcon';
import { MODULE_ICON_SCALE } from './constants';

interface Props {
  module: ModuleDef;
  on: boolean;
  onToggle: () => void;
}

/** A selectable equipment card: icon, name, what it does, and its price in resources. */
export function ModuleCard({ module: m, on, onToggle }: Props) {
  const power = m.powerW > 0 ? `+${m.powerW} W` : m.powerW < 0 ? `${m.powerW} W` : '';
  return (
    <button
      className={`panel module-card ${on ? 'on' : ''}`}
      data-group={m.group}
      aria-pressed={on}
      onClick={onToggle}
    >
      {on && <span className="badge">{t('design.installed')}</span>}
      <PixelIcon name={`icon_${m.id}`} scale={MODULE_ICON_SCALE} />
      <b>{t(`module.${m.id}.name`)}</b>
      <small>{t(`module.${m.id}.desc`)}</small>
      <span className="module-stats">
        <span className="chip">${m.cost}</span>
        <span className="chip">{m.massKg} kg</span>
        {power && <span className={`chip ${m.powerW > 0 ? 'plus' : 'minus'}`}>{power}</span>}
      </span>
    </button>
  );
}
