import { GAUGE_WARN_FRAC } from './constants';

interface Props {
  label: string;
  value: string;
  /** 0..1 and beyond; undefined hides the bar. */
  ratio?: number;
  bad: boolean;
  description?: string;
  resource?: string;
  warnWhenFull?: boolean;
}

/** One mission resource: label, numbers and a segmented bar that warms up near the limit. */
export function Gauge({
  label,
  value,
  ratio,
  bad,
  description,
  resource,
  warnWhenFull = true,
}: Props) {
  const fill = Math.max(0, Math.min(1, ratio ?? 0)) * 100;
  const warn = warnWhenFull && !bad && ratio !== undefined && ratio >= GAUGE_WARN_FRAC;
  return (
    <div
      data-resource={resource}
      className={`panel gauge ${bad ? 'err' : ''} ${warn ? 'warn-state' : ''}`}
    >
      <h2>{label}</h2>
      <output>{value}</output>
      {ratio !== undefined && (
        <div
          className="gauge-bar"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill)}
        >
          <i style={{ width: `${fill}%` }} />
        </div>
      )}
      {description && <small className="resource-why">{description}</small>}
    </div>
  );
}
