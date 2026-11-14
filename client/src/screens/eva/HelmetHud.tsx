import { useEffect, useRef } from 'react';
import { audio } from '../../audio';
import { O2, RETURN, returnCost } from '@rs/shared';
import type { EvaState, MissionParams } from '@rs/shared';
import { evaText as t } from '../../i18n/en/eva';
import { usePrefs } from '../../state/prefs';

export function clock(t: number): string {
  const s = Math.max(0, Math.ceil(t));
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
  const frac = a.o2 / a.o2Max,
    low = frac < O2.lowFrac;
  const tremor = snap.fx.some((f) => f.type === 'tremor' && snap.t - f.t < 2);
  const danger = a.linked && snap.t < a.dangerUntil;
  const storm = snap.weather.storm;
  const active = storm && snap.t >= storm.tStart && snap.t < storm.tEnd;
  const nearbyDown = snap.astronauts.some(
    (b) =>
      b.id !== a.id && b.status === 'down' && Math.hypot(a.x - b.x, a.y - b.y) <= O2.shareRange,
  );
  const atLander = Math.hypot(a.x - snap.lander.x, a.y - snap.lander.y) <= O2.airlockRadius;
  const log = snap.log.at(-1);
  const hint =
    a.status === 'inside'
      ? 'eva.exit'
      : a.status !== 'active'
        ? ''
        : nearbyDown
          ? 'eva.rescue'
          : atLander
            ? 'eva.airlock'
            : '';
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
  return (
    <div
      className={`helmet-hud ${low ? 'low-oxygen' : ''} ${a.leak ? 'suit-breach' : ''} ${reduce ? 'reduce-motion' : ''}`}
      data-status={a.status}
      data-return-cost={needed.toFixed(2)}
    >
      <div className="visor-frame" aria-hidden="true" />
      <header className="helmet-top">
        <div className="helmet-block oxygen-block">
          <span>
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
        </div>
        <div className="helmet-clock">
          {snap.t < 0 ? `T−${Math.ceil(-snap.t)}` : clock(snap.durationS - snap.t)}
        </div>
        <div className={`helmet-block link-block ${a.linked ? '' : 'helmet-warning'}`}>
          {t(a.linked ? 'eva.link' : 'eva.no_signal')}
          <small>
            {t('eva.deposited')} {snap.lander.cache.length}/{params.quota}
          </small>
        </div>
      </header>
      <div className="helmet-banners" role="status">
        {snap.t < 0 && (
          <div className="helmet-banner">{t('eva.countdown', { n: Math.ceil(-snap.t) })}</div>
        )}
        {a.status === 'down' && (
          <div className="helmet-banner critical">
            {t('eva.down', { time: clock(a.downUntil - snap.t) })}
          </div>
        )}
        {a.status === 'inside' && <div className="helmet-banner">{t('eva.inside')}</div>}
        {a.status === 'lost' && <div className="helmet-banner critical">{t('eva.lost')}</div>}
        {a.status === 'active' && (
          <>
            {returnNow && (
              <div className="helmet-banner critical" data-return-warning>
                {t('eva.return_now')}
              </div>
            )}
            {!returnNow && danger && (
              <div className="helmet-banner critical">{t('eva.danger')}</div>
            )}
            {!returnNow && tremor && <div className="helmet-banner">{t('eva.tremor')}</div>}
            {!a.linked && <div className="helmet-banner">{t('eva.no_signal')}</div>}
            {!returnNow && active ? (
              <div className="helmet-banner">{t('eva.storm')}</div>
            ) : !returnNow && storm && snap.t < storm.tStart ? (
              <div className="helmet-banner">
                {t('eva.forecast', { n: Math.ceil(storm.tStart - snap.t) })}
              </div>
            ) : null}
            {a.wantsRefill && (
              <div className="helmet-banner">
                {t(snap.lander.ration && !a.refillGranted ? 'eva.ration' : 'eva.refill')}
              </div>
            )}
          </>
        )}
      </div>
      <footer className="helmet-bottom">
        <div className="helmet-samples">
          <span>{t('eva.samples')}</span>
          {[0, 1].map((i) => (
            <div className={`sample-slot ${a.carrying[i] ? 'occupied' : ''}`} key={i}>
              {a.carrying[i]
                ? `${t(`eva.${a.carrying[i]!.tier}`)} +${a.carrying[i]!.value}`
                : t('eva.empty')}
            </div>
          ))}
        </div>
        {a.linked && a.waypoint && (
          <div className="helmet-beacon">
            {t('eva.waypoint', {
              n: Math.round(Math.hypot(a.x - a.waypoint.x, a.y - a.waypoint.y) * 0.25),
            })}
          </div>
        )}
        <div className="helmet-instructions">
          {hint && <b>{t(hint)}</b>}
          {lesson && <span>{t(lesson)}</span>}
          <small>{t('eva.controls')}</small>
        </div>
        {log && a.linked && (
          <div className="helmet-radio" key={log.id}>
            <span>{t(log.key, log.params)}</span>
          </div>
        )}
      </footer>
    </div>
  );
}
