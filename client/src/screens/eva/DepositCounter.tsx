import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { FIELD } from '../../game/style';
export function DepositCounter({ total }: { total: number }) {
  const previous = useRef(total);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const delta = total - previous.current;
    previous.current = total;
    if (delta <= 0) return;
    setCount(delta);
    const timer = setTimeout(() => setCount(0), FIELD.fxDurationMs);
    return () => clearTimeout(timer);
  }, [total]);
  return count > 0 ? (
    <div className="deposit-counter" role="status">
      {t('eva.deposit_count', { n: count })}
    </div>
  ) : null;
}
