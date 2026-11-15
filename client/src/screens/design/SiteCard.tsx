import { useEffect, useRef } from 'react';
import { LANDER_POS, SITES, WORLD_MIN, WORLD_PX } from '@rs/shared';
import type { SiteId } from '@rs/shared';
import { biomeMap } from '../../render/biomeMap';
import { send } from '../../net/session';
import { t } from '../../i18n';
import '../../ui/forecast.css';
export function SiteCard({
  id,
  selected,
  suggested,
}: {
  id: SiteId;
  selected: boolean;
  suggested: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const site = SITES[id];
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    // The whole valley around this landing site: its biomes and lava tubes (v2.1 big world).
    const size = 64;
    const map = biomeMap(site.terrainSalt);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(map, 0, 0, map.width, map.height, 0, 0, size, size);
    ctx.fillStyle = '#50e6f0';
    ctx.fillRect(
      ((LANDER_POS.x - WORLD_MIN) / WORLD_PX) * size - 1,
      ((LANDER_POS.y - WORLD_MIN) / WORLD_PX) * size - 1,
      3,
      3,
    );
  }, [site.terrainSalt]);
  return (
    <button
      className={`site-card ${selected ? 'on' : ''} ${suggested ? 'suggested' : ''}`}
      aria-pressed={selected}
      onClick={() => send({ t: 'design:set', field: 'site', value: id })}
    >
      <canvas ref={canvas} width={64} height={64} aria-hidden="true" />
      <b>{t(`site.${id}.name`)}</b>
      <small>{t(`design.site_fact.${id}`)}</small>
      <span>
        {t('design.site_stats', {
          sun: Math.round(site.solarFactor * 100),
          quakes: site.quakes,
          storm: Math.round(site.stormChance * 100),
        })}
      </span>
      {suggested && <em>{t('design.suggested')}</em>}
    </button>
  );
}
