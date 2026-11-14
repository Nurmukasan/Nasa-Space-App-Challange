import { useState } from 'react';

/** Native sprite size; icons are drawn 32x32 and scaled by integer factors only. */
const ICON_SIZE_PX = 32;

interface Props {
  /** File key without extension, e.g. `icon_solar`. */
  name: string;
  scale?: number;
}

/** Pixel-art icon from the sprites folder. Hides itself if the PNG is missing. */
export function PixelIcon({ name, scale = 2 }: Props) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  const size = ICON_SIZE_PX * scale;
  return (
    <img
      className="px-icon"
      src={`${import.meta.env.BASE_URL}assets/sprites/${name}.png`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setMissing(true)}
    />
  );
}
