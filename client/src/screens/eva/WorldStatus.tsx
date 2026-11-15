import { useEffect, useRef, useState } from 'react';
import { SITES, biomeAt, inCave } from '@rs/shared';
import type { Astronaut, BiomeId, EvaState, MissionParams } from '@rs/shared';
import { t } from '../../i18n';
import { HUD } from './style';

/** Big world: where you are (biome, lava tube) and the rover battery while driving. */
export function WorldStatus({
  snap,
  a,
  params,
}: {
  snap: EvaState;
  a: Astronaut;
  params: MissionParams;
}) {
  if (!params.bigWorld) return null;
  const salt = SITES[params.site].terrainSalt;
  const biome = biomeAt(a.x, a.y, salt);
  const cave = inCave(a.x, a.y, salt);
  return (
    <small className={`helmet-world ${cave ? 'helmet-warning' : ''}`} data-biome={biome}>
      {t(`eva.biome.${biome}`)}
      {cave && ` · ${t('eva.in_cave')}`}
      {a.inRover &&
        snap.rover &&
        ` · ${t('eva.rover_battery', { n: Math.round(snap.rover.charge * 100) })}`}
    </small>
  );
}

/** A title card when the crew member walks into a new region of the valley. */
export function BiomeTitle({ a, params }: { a: Astronaut; params: MissionParams }) {
  const biome: BiomeId | null = params.bigWorld
    ? biomeAt(a.x, a.y, SITES[params.site].terrainSalt)
    : null;
  const last = useRef<BiomeId | null>(biome);
  const [shown, setShown] = useState<BiomeId | null>(null);
  useEffect(() => {
    if (!biome || biome === last.current) return;
    last.current = biome;
    setShown(biome);
    const timer = setTimeout(() => setShown(null), HUD.actTitleMs);
    return () => clearTimeout(timer);
  }, [biome]);
  if (!shown) return null;
  return (
    <div className="helmet-act-title helmet-biome-title" key={shown}>
      {t('eva.biome_enter')}
      <strong>{t(`eva.biome.${shown}`)}</strong>
    </div>
  );
}
