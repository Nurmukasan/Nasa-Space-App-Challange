import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { HUD } from './style';

type Hint = { key: string; params?: Record<string, string | number> };

/**
 * The single action line at the bottom of the helmet. A new instruction replaces the old one only
 * after it has held for a moment, so walking past a threshold does not make the text flicker.
 */
export function ActionLine({ hint, showControls }: { hint: Hint; showControls: boolean }) {
  const [shown, setShown] = useState(hint);
  const signature = hint.key + JSON.stringify(hint.params ?? null);
  useEffect(() => {
    if (hint.key === shown.key) {
      setShown(hint);
      return;
    }
    const timer = setTimeout(() => setShown(hint), HUD.hintHoldMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  return (
    <div className="helmet-instructions">
      <b>{t(shown.key, shown.params)}</b>
      {showControls && <small className="controls-hint">{t('eva.controls')}</small>}
    </div>
  );
}
