import { useEffect, useRef } from 'react';
import { FLARE, O2, RETURN, SITES, returnCost } from '@rs/shared';
import type { EvaState, MissionParams } from '@rs/shared';
import { audio } from '../../audio';
import { t } from '../../i18n';
import { usePrefs } from '../../state/prefs';
import { PixelIcon } from '../../ui/PixelIcon';
import { MissionObjectives, ActTitle } from './MissionStatus';
import { Scanner } from './Scanner';
import { RadioLine } from './RadioLine';
import { actionHint, hudBanner } from './hudView';
import { HUD } from './style';
import '../../ui/hudV2.css';

const GEM_FRAME: Record<string, number> = { surface: 0, deep: 1, core: 2 };
const GEM_PX = 24;
/** The key reminder only matters at the start of a mission. */
const CONTROLS_SHOWN_S = 25;

export function clock(time: number): string {
  const s = Math.max(0, Math.ceil(time));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export function HelmetHud({
  snap,
  playerId,
  params,
}: {
  snap: EvaState;
  playerId: string;
  params: MissionParams;
}) {
  const reduce = usePrefs((p) => p.reduceMotion);
  const glass = usePrefs((p) => p.visorGlass);
  const tutorial = useRef({ moved: false, dug: false, returned: false, x: NaN, y: NaN });
  const a = snap.astronauts.find((a) => a.id === playerId);
  const needed = a ? returnCost(params, snap.weather, a.x, a.y) : 0;
  const returnNow =
    !!a && snap.t >= 0 && a.status === 'active' && a.o2 < needed + RETURN.warningUnits;
  useEffect(() => {
    if (returnNow) audio.sfx('radio_in');
  }, [returnNow]);
  if (!a) return null;
  const first = tutorial.current;
  if (Number.isNaN(first.x)) {
    first.x = a.x;
    first.y = a.y;
  }
  first.moved ||= Math.hypot(a.x - first.x, a.y - first.y) > 12;
  first.dug ||= a.carrying.length > 0 || snap.lander.cache.length > 0;
  first.returned ||= snap.lander.cache.length > 0;
  const frac = a.o2 / a.o2Max;
  const banner = hudBanner(snap, a, needed);
  const hint = actionHint(snap, a, SITES[params.site].terrainSalt);
  const hintParams = hint.params?.fault
    ? { ...hint.params, fault: t(`eva.fault.${hint.params.fault}`) }
    : hint.params;
  const lesson =
    snap.t >= 0 && snap.t < 60
      ? !first.moved
        ? 'eva.move'
        : !first.dug
          ? 'eva.dig'
          : !first.returned
            ? 'eva.return'
            : ''
      : '';
  const log = snap.log.at(-1);
  const storm = snap.weather.storm;
  const stormOn = !!storm && snap.t >= storm.tStart && snap.t < storm.tEnd;
  const tremor = snap.fx.some((f) => f.type === 'tremor' && snap.t - f.t < 5);
  const homeDist = Math.hypot(snap.lander.x - a.x, snap.lander.y - a.y);
  const homeAngle = Math.atan2(snap.lander.y - a.y, snap.lander.x - a.x);
  return (
    <div
      className={`helmet-hud ${frac < O2.lowFrac ? 'low-oxygen' : ''} ${a.leak ? 'suit-breach' : ''} ${stormOn ? 'storm-on' : ''} ${tremor ? 'quake' : ''} ${reduce ? 'reduce-motion' : ''} ${glass ? 'visor-glass' : ''}`}
      data-status={a.status}
      data-return-cost={needed.toFixed(2)}
    >
      <div className="visor-frame" aria-hidden="true" />
      <header className="helmet-top">
        <div className="helmet-block oxygen-block">
          <span className="block-head">
            <PixelIcon name="icon_tanks_xl" scale={1} />
            {t('eva.oxygen')} <strong>{Math.round(frac * 100)}%</strong>
          </span>
          <div
            className="oxygen-segments"
            role="progressbar"
            aria-label={t('eva.oxygen')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(frac * 100)}
          >
            {Array.from({ length: 20 }, (_, i) => (
              <i key={i} className={frac * 20 > i ? 'filled' : ''} />
            ))}
          </div>
          <div className="return-track" aria-label={t('eva.return_cost', { n: Math.ceil(needed) })}>
            <i
              className="return-marker"
              style={{ left: `${Math.min(100, (needed / a.o2Max) * 100)}%` }}
            />
            <span>{t('eva.return_cost', { n: Math.ceil(needed) })}</span>
          </div>
          {a.leak && <b className="helmet-warning">{t('eva.breach')}</b>}
          {params.scenario !== 'free' && (
            <label className="helmet-dose">
              {t('eva.dose', { n: Math.round(a.dose) })}
              <meter
                min={0}
                max={FLARE.doseLimit}
                value={a.dose}
                aria-label={t('eva.dose_label')}
              />
            </label>
          )}
        </div>
        <div className="helmet-clock">
          {snap.t < 0 ? `T−${Math.ceil(-snap.t)}` : clock(snap.durationS - snap.t)}
          {params.scenario !== 'free' && (
            <small>
              {t('eva.act', { n: snap.act })} · {t(`eva.act.${snap.act}`)}
            </small>
          )}
        </div>
        <div className={`helmet-block link-block ${a.linked ? '' : 'helmet-warning'}`}>
          <span className="block-head">
            {t(a.linked ? 'eva.link' : 'eva.no_signal')}
            <PixelIcon name="icon_antenna_hg" scale={1} />
          </span>
          <MissionObjectives snap={snap} />
          {snap.objectives.length === 0 && (
            <>
              <div className="quota-pips" aria-hidden="true">
                {Array.from({ length: Math.min(params.quota, 12) }, (_, i) => (
                  <i key={i} className={i < snap.lander.cache.length ? 'filled' : ''} />
                ))}
              </div>
              <small>
                {t('eva.deposited')} {snap.lander.cache.length}/{params.quota}
              </small>
            </>
          )}
        </div>
      </header>
      {a.status === 'active' && homeDist > O2.airlockRadius * 2 && (
        <div className="helmet-home" aria-label="lander bearing">
          <span className="home-arrow" style={{ transform: `rotate(${homeAngle}rad)` }}>
            ➤
          </span>
          <span>{t('eva.lander_bearing', { n: Math.round(homeDist * HUD.metresPerPx) })}</span>
        </div>
      )}
      <ActTitle snap={snap} />
      <div className="helmet-banners" role="status">
        {banner && (
          <div
            className={`helmet-banner ${banner.critical ? 'critical' : ''}`}
            data-alert={banner.key}
            data-return-warning={banner.key === 'eva.return_now' ? true : undefined}
          >
            {t(banner.key, banner.params)}
          </div>
        )}
      </div>
      <footer className="helmet-bottom">
        <div className="helmet-inventory">
          <div className="helmet-samples">
            <span>{t('eva.samples')}</span>
            {Array.from({ length: params.carryCap }, (_, i) => (
              <div className={`sample-slot ${a.carrying[i] ? 'occupied' : ''}`} key={i}>
                {a.carrying[i] ? (
                  <>
                    <span
                      className="gem"
                      style={{
                        backgroundImage: `url(${import.meta.env.BASE_URL}assets/sprites/samples.png)`,
                        backgroundPositionX: -GEM_FRAME[a.carrying[i]!.tier]! * GEM_PX,
                      }}
                    />
                    <span>
                      {t(`eva.${a.carrying[i]!.tier}`)} <b>+{a.carrying[i]!.value}</b>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="gem empty" />
                    <span>{t('eva.empty')}</span>
                  </>
                )}
              </div>
            ))}
          </div>
          {params.deployStations && (
            <small className="helmet-kits">{t('eva.kits', { n: a.kits })}</small>
          )}
        </div>
        <Scanner astronaut={a} />
        {a.linked && a.waypoint && (
          <div className="helmet-beacon">
            {t('eva.waypoint', {
              n: Math.round(Math.hypot(a.x - a.waypoint.x, a.y - a.waypoint.y) * HUD.metresPerPx),
            })}
          </div>
        )}
        <div className="helmet-instructions">
          <b>{t(hint.key, hintParams)}</b>
          {lesson && <span>{t(lesson)}</span>}
          {snap.t < CONTROLS_SHOWN_S && (
            <small className="controls-hint">{t('eva.controls')}</small>
          )}
        </div>
        {log && a.linked && <RadioLine entry={log} />}
      </footer>
    </div>
  );
}
