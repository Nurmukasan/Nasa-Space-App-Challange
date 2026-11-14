import { BAYS_MAX, MODULES, MODULE_ORDER, VEHICLES } from '@rs/shared';
import type { MissionDesign } from '@rs/shared';
import { t } from '../../i18n';
import { send } from '../../net/session';
import { AssetImage } from '../../ui/AssetImage';

export function LanderCutaway({ design, mass }: { design: MissionDesign; mass: number }) {
  const installed = MODULE_ORDER.filter((id) => design.modules.includes(id));
  const occupied = installed.flatMap((id) => Array.from({ length: MODULES[id].bays }, () => id));
  const vehicle = VEHICLES[design.vehicle];
  return (
    <section className="spacecraft-layout">
      <aside className="rocket-figure">
        <AssetImage
          asset={`rocket_${design.vehicle}`}
          width={48}
          height={128}
          fallback={
            <span className="rocket-placeholder">
              ▲<i style={{ height: `${Math.min(100, (mass / vehicle.payloadKg) * 100)}%` }} />
            </span>
          }
        />
        <b>{t(`vehicle.${design.vehicle}.name`)}</b>
        <small>{t('design.payload', { mass, max: vehicle.payloadKg })}</small>
      </aside>
      <div className="cutaway">
        <h2>{t('design.ship')}</h2>
        <AssetImage
          className="cutaway-art"
          asset="lander_cutaway"
          width={240}
          height={160}
          fallback={<span className="cutaway-outline" />}
        />
        <div className="bay-grid">
          {Array.from({ length: BAYS_MAX }, (_, index) => {
            const id = occupied[index];
            return id ? (
              <button
                key={`${index}-${id}`}
                className={`bay bay-${MODULES[id].group}`}
                aria-label={t('design.remove_module', { name: t(`module.${id}.name`) })}
                onClick={() => send({ t: 'design:module', id, on: false })}
              >
                <AssetImage asset={`icon_${id}`} width={24} height={24} />
                <span>{t(`module.${id}.name`)}</span>
              </button>
            ) : (
              <div className="bay empty-bay" key={index}>
                {t('design.empty_bay', { n: index + 1 })}
              </div>
            );
          })}
        </div>
        <small className={occupied.length > BAYS_MAX ? 'err' : ''}>
          {t('design.bay_count', { n: occupied.length, max: BAYS_MAX })}
        </small>
        {design.modules.includes('tanks_xl') && (
          <div className="suit-tanks">
            <AssetImage asset="icon_tanks_xl" />
            {t('design.external_tanks')}
          </div>
        )}
      </div>
    </section>
  );
}
