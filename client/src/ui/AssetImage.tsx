import type { ReactNode } from 'react';
import { spriteFiles } from '../game/assets';
/** Missing art uses an explicit fallback without issuing a failed request. */
export function AssetImage({
  asset,
  alt = '',
  fallback,
  className,
  width = 32,
  height = 32,
}: {
  asset: string;
  alt?: string;
  fallback?: ReactNode;
  className?: string;
  width?: number;
  height?: number;
}) {
  return spriteFiles[`/public/assets/sprites/${asset}.png`] ? (
    <img
      className={className}
      src={`${import.meta.env.BASE_URL}assets/sprites/${asset}.png`}
      alt={alt}
      width={width}
      height={height}
    />
  ) : (
    <span className={className} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      {fallback ?? '◈'}
    </span>
  );
}
