import { DIFFICULTIES, OBJECTIVES, RELAYS, SITES, VEHICLES } from '@rs/shared';
import type { DesignField } from '@rs/shared';
import { t } from '../../i18n';
import { send } from '../../net/session';
import { AssetImage } from '../../ui/AssetImage';

function brief(field: DesignField, id: string): string {
  switch (field) {
    case 'objective': {
      const value = OBJECTIVES[id as keyof typeof OBJECTIVES];
      return t('design.choice.objective', { n: value.quota, deep: value.deepQuota });
    }
    case 'site': {
      const value = SITES[id as keyof typeof SITES];
      return t('design.choice.site', {
        sun: Math.round(value.solarFactor * 100),
        storm: Math.round(value.stormChance * 100),
      });
    }
    case 'vehicle': {
      const value = VEHICLES[id as keyof typeof VEHICLES];
      return t('design.choice.vehicle', { cost: value.cost, mass: value.payloadKg });
    }
    case 'relay': {
      const value = RELAYS[id as keyof typeof RELAYS];
      return t('design.choice.relay', { cost: value.cost, data: value.dataCap });
    }
    case 'difficulty': {
      const value = DIFFICULTIES[id as keyof typeof DIFFICULTIES];
      return t('design.choice.difficulty', { budget: value.budget, n: value.classifyWindowS });
    }
  }
}
export function ChoiceCards({
  field,
  options,
  selected,
}: {
  field: DesignField;
  options: string[];
  selected: string;
}) {
  return (
    <section className="choice-section">
      <h2>{t(`design.field.${field}`)}</h2>
      <div className="choice-cards">
        {options.map((id) => (
          <button
            key={id}
            aria-pressed={id === selected}
            className={id === selected ? 'on' : ''}
            onClick={() => send({ t: 'design:set', field, value: id })}
          >
            <AssetImage
              asset={
                field === 'vehicle'
                  ? `icon_vehicle_${id}`
                  : field === 'relay'
                    ? `icon_relay_${id}`
                    : ''
              }
              fallback={field === 'site' ? '◎' : '◇'}
            />
            <b>{t(`${field}.${id}.name`)}</b>
            <small>{brief(field, id)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
