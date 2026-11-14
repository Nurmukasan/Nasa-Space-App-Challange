/** SVG filter that makes shapes look rubber-stamped: wobbly edges and patches of missing ink. */
export function InkFilter() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
      <filter id="ink-rough" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.035"
          numOctaves="2"
          seed="4"
          result="warp"
        />
        <feDisplacementMap in="SourceGraphic" in2="warp" scale="4" result="rough" />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.7"
          numOctaves="3"
          seed="9"
          result="grain"
        />
        <feColorMatrix
          in="grain"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -10 7.4"
          result="holes"
        />
        <feComposite in="rough" in2="holes" operator="in" />
      </filter>
    </svg>
  );
}
