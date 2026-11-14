import { useEffect, useRef } from 'react';
import { LANDER_POS, SITES, WORLD_PX, levelAt } from '@rs/shared';
import type { SiteId } from '@rs/shared';
import { terrainPaint } from '../../render/terrainPaint';
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
    const size = 64,
      levels = new Uint8Array(size * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        levels[y * size + x] = levelAt(
          (x / size) * WORLD_PX,
          (y / size) * WORLD_PX,
          site.terrainSalt,
        );
    ctx.putImageData(
      new ImageData(new Uint8ClampedArray(terrainPaint(levels, size, size)), size, size),
      0,
      0,
    );
    ctx.fillStyle = '#50e6f0';
    ctx.fillRect((LANDER_POS.x / WORLD_PX) * size - 1, (LANDER_POS.y / WORLD_PX) * size - 1, 3, 3);
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
