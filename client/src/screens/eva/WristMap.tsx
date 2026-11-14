import { useEffect, useRef } from 'react';
import { t } from '../../i18n';
import { send } from '../../net/session';
import { snaps } from '../../state/snapshots';
import { drawMiniMap, miniMapPoint } from '../../render/miniMap';

export function WristMap({ playerId }: { playerId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const ctx = canvas.current?.getContext('2d');
      if (ctx && snaps.curr) drawMiniMap(ctx, snaps.curr, playerId);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [playerId]);
  return (
    <section className="wrist-map">
      <h2>{t('eva.wrist_map')}</h2>
      <canvas
        ref={canvas}
        width={128}
        height={128}
        aria-label={t('eva.map_help')}
        title={t('eva.map_help')}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const point = miniMapPoint(
            event.clientX - rect.left,
            event.clientY - rect.top,
            rect.width,
            rect.height,
          );
          send({ t: 'mc:waypoint', playerId, ...point });
        }}
      />
      <button
        onClick={() => {
          const lander = snaps.curr?.lander;
          if (lander) send({ t: 'mc:waypoint', playerId, x: lander.x, y: lander.y });
        }}
      >
        {t('eva.home_beacon')}
      </button>
    </section>
  );
}
