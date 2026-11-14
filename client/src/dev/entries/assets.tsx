import { useEffect, useMemo, useRef, useState } from 'react';
import { ASSETS as ASSET_MANIFEST } from '../../game/assetManifest';
import type { AssetSpec as AssetDef } from '../../game/assetManifest';
import { placeholderSheet } from '../../game/placeholder';
import { spriteFiles } from '../../game/assets';
import { SOUND_MANIFEST } from '../../audio/soundManifest';
import { sources } from '../../audio/sounds';
import { audio } from '../../audio';
import { t } from '../../i18n';
import '../../ui/assetGallery.css';
export const name = 'assets';
export function render() {
  return <AssetGallery />;
}
function Preview({ asset, tick }: { asset: AssetDef; tick: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const fallback = useMemo(() => placeholderSheet(asset), [asset]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const present = !!spriteFiles[`/public/assets/sprites/${asset.key}.png`];
  useEffect(() => {
    if (!present) return;
    let live = true;
    const loaded = new Image();
    loaded.onload = () => {
      if (live && loaded.width === asset.width * asset.frames && loaded.height === asset.height)
        setImage(loaded);
    };
    loaded.src = `${import.meta.env.BASE_URL}assets/sprites/${asset.key}.png`;
    return () => {
      live = false;
      loaded.onload = null;
    };
  }, [asset, present]);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, asset.width, asset.height);
    ctx.drawImage(
      image ?? fallback,
      (tick % asset.frames) * asset.width,
      0,
      asset.width,
      asset.height,
      0,
      0,
      asset.width,
      asset.height,
    );
  }, [asset, tick, image, fallback]);
  return (
    <article className="asset-card" data-key={asset.key} data-source={image ? 'file' : 'fallback'}>
      <div className="asset-preview">
        <canvas
          ref={canvas}
          width={asset.width}
          height={asset.height}
          aria-label={asset.key}
          style={{ maxWidth: '100%', maxHeight: 140, width: Math.min(240, asset.width * 3) }}
        />
      </div>
      <code>{asset.key}.png</code>
      <small>
        {asset.width} × {asset.height} · {asset.frames} {t('dev.assets.frames')} · {asset.use}
      </small>
      <span className={image ? 'ok' : 'dim'}>
        {t(image ? 'dev.assets.file' : 'dev.assets.fallback')}
      </span>
    </article>
  );
}
function AssetGallery() {
  const [tick, setTick] = useState(0),
    [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 125);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      for (const sound of SOUND_MANIFEST) audio.stop(sound.name);
    },
    [],
  );
  return (
    <main className="asset-gallery">
      <h1>{t('dev.assets.title')}</h1>
      <p>{t('dev.assets.help')}</p>
      <h2>{t('dev.assets.sprites', { n: ASSET_MANIFEST.length })}</h2>
      <div className="asset-grid">
        {ASSET_MANIFEST.map((asset) => (
          <Preview asset={asset} tick={tick} key={asset.key} />
        ))}
      </div>
      <h2>{t('dev.assets.sounds', { n: SOUND_MANIFEST.length })}</h2>
      <div className="sound-grid">
        {SOUND_MANIFEST.map((sound) => {
          const available = sources(sound.name).length > 0;
          return (
            <article
              className="asset-card"
              key={sound.name}
              data-sound={sound.name}
              data-source={available ? 'file' : 'fallback'}
            >
              <code>
                {sound.folder}/{sound.name}
              </code>
              <span>{t(available ? 'dev.assets.file' : 'dev.assets.tone')}</span>
              <button
                onClick={async () => {
                  await audio.unlock();
                  if (playing) {
                    const old = SOUND_MANIFEST.find((s) => s.name === playing);
                    if (old) audio.stop(old.name);
                  }
                  if (playing === sound.name) {
                    setPlaying(null);
                    return;
                  }
                  if (sound.folder === 'music' && available) audio.loop(sound.name);
                  else
                    audio.sfx(
                      sound.folder === 'sfx'
                        ? (sound.name as import('../../audio').SfxName)
                        : 'ui_click',
                    );
                  setPlaying(sound.name);
                }}
              >
                {t(playing === sound.name ? 'dev.assets.stop' : 'dev.assets.play')}
              </button>
            </article>
          );
        })}
      </div>
    </main>
  );
}
