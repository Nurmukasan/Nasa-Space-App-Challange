import { useEffect } from 'react';
import { audio } from '../../audio';
import { t } from '../../i18n';
import { usePrefs } from '../../state/prefs';
import { AssetImage } from '../../ui/AssetImage';
import { spriteFiles } from '../../game/assets';
import '../../ui/cinematics.css';
export const TAKEOFF_MS = 3000;
export function Takeoff() {
  const reduce = usePrefs((p) => p.reduceMotion);
  useEffect(() => {
    audio.sfx('launch');
  }, []);
  const flame = spriteFiles['/public/assets/sprites/lander_flame.png'];
  return (
    <div className={`takeoff-scene ${reduce ? 'reduce-motion' : ''}`} role="status">
      <div className="takeoff-horizon" />
      <div className="takeoff-ship">
        <AssetImage
          asset="lander"
          width={192}
          height={144}
          fallback={<span className="takeoff-fallback" />}
        />
        <i
          className={`takeoff-flame ${flame ? 'has-sheet' : ''}`}
          style={
            flame
              ? {
                  backgroundImage: `url(${import.meta.env.BASE_URL}assets/sprites/lander_flame.png)`,
                }
              : undefined
          }
        />
      </div>
      <h1>{t('eva.liftoff')}</h1>
      <p>{t('eva.returning_orbit')}</p>
    </div>
  );
}
