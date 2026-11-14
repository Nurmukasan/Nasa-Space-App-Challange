import { useState } from 'react';
import { SCENARIOS, SITES, WEATHER } from '@rs/shared';
import type { MissionForecast, ScenarioId, SiteId } from '@rs/shared';
import { t } from '../../i18n';
import { CHART, forecastGeometry } from './forecastGeometry';
import '../../ui/forecast.css';
const clock = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
export function ForecastChart({
  forecast,
  scenario,
  site,
}: {
  forecast: MissionForecast;
  scenario: ScenarioId;
  site: SiteId;
}) {
  const [cursor, setCursor] = useState(0);
  const mission = SCENARIOS[scenario];
  const points = forecast.points;
  if (!points.length)
    return (
      <section className="panel forecast-chart">
        <h2 className="panel-title">{t('design.forecast_graph')}</h2>
        <p className="dim">{t('design.forecast_pending')}</p>
      </section>
    );
  const g = forecastGeometry(points, mission.durationS);
  const index = Math.min(cursor, points.length - 1),
    point = points[index]!;
  const stormFrom = Math.min(mission.durationS, WEATHER.stormEarliestS);
  const stormTo = Math.min(mission.durationS, WEATHER.stormLatestS + WEATHER.stormDurS);
  return (
    <section className="panel forecast-chart">
      <h2 className="panel-title">{t('design.forecast_graph')}</h2>
      <svg
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        role="img"
        aria-label={t('design.forecast_graph_help')}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * CHART.width;
          const time =
            Math.max(0, Math.min(1, (x - CHART.left) / (CHART.right - CHART.left))) *
            mission.durationS;
          let nearest = 0;
          for (let i = 1; i < points.length; i++)
            if (Math.abs(points[i]!.t - time) < Math.abs(points[nearest]!.t - time)) nearest = i;
          setCursor(nearest);
        }}
      >
        <rect
          x={g.x(mission.duskEndS)}
          y={CHART.top}
          width={CHART.right - g.x(mission.duskEndS)}
          height={CHART.bottom - CHART.top}
          className="forecast-night"
        />
        {scenario !== 'training' && SITES[site].stormChance > 0 && (
          <rect
            x={g.x(stormFrom)}
            y={CHART.top}
            width={g.x(stormTo) - g.x(stormFrom)}
            height={CHART.bottom - CHART.top}
            className="forecast-storm"
          />
        )}
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1={CHART.left}
              x2={CHART.right}
              y1={g.y(v, 1)}
              y2={g.y(v, 1)}
              className="forecast-grid"
            />
            <text x={CHART.left - 4} y={g.y(v, 1) + 3} textAnchor="end">
              {Math.round(v * g.maxPower)}
            </text>
            <text x={CHART.right + 4} y={g.y(v, 1) + 3}>
              {Math.round(v * g.maxOxygen)}
            </text>
          </g>
        ))}
        <text x={CHART.left} y={14}>
          {t('design.forecast_watts')}
        </text>
        <text x={CHART.right} y={14} textAnchor="end">
          {t('design.forecast_oxygen')}
        </text>
        <path d={g.power} className="forecast-power" />
        <path d={g.need} className="forecast-need" />
        <path d={g.oxygen} className="forecast-o2" />
        <line
          x1={g.x(point.t)}
          x2={g.x(point.t)}
          y1={CHART.top}
          y2={CHART.bottom}
          className="forecast-cursor"
        />
        {[0, mission.duskEndS, mission.durationS].map((time) => (
          <text key={time} x={g.x(time)} y={CHART.bottom + 17} textAnchor="middle">
            {clock(time)}
          </text>
        ))}
      </svg>
      <div className="forecast-legend">
        <span className="power-key">{t('design.forecast_available')}</span>
        <span className="need-key">{t('design.forecast_need')}</span>
        <span className="o2-key">{t('design.forecast_oxygen')}</span>
        <span>{t('design.forecast_night')}</span>
        {scenario !== 'training' && SITES[site].stormChance > 0 && (
          <span>{t('design.forecast_storm')}</span>
        )}
      </div>
      <input
        type="range"
        min={0}
        max={points.length - 1}
        value={index}
        onChange={(e) => setCursor(Number(e.target.value))}
        aria-label={t('design.forecast_cursor')}
      />
      <output className="forecast-readout">
        {t('design.forecast_at', {
          time: clock(point.t),
          power: Math.round(point.powerW),
          need: Math.round(point.needW),
          oxygen: Math.round(point.o2Store),
        })}
      </output>
      <div className="forecast-callouts">
        <p className={forecast.powerShortAtS !== null ? 'warn' : 'ok'}>
          {forecast.powerShortAtS !== null
            ? t('design.forecast_power_short', { time: clock(forecast.powerShortAtS) })
            : t('design.forecast_power_ok')}
        </p>
        <p className={forecast.storeEmptyAtS !== null ? 'warn' : 'ok'}>
          {forecast.storeEmptyAtS !== null
            ? t('design.forecast_o2_short', { time: clock(forecast.storeEmptyAtS) })
            : t('design.forecast_o2_ok')}
        </p>
        <p>{t('design.forecast_reach', { n: Math.round(forecast.deepReachM) })}</p>
      </div>
    </section>
  );
}
