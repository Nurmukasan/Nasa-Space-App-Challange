import type { Award, PlayerInfo } from '@rs/shared';
import { t } from '../../i18n';
import { AssetImage } from '../../ui/AssetImage';
export function Awards({ awards, players }: { awards: Award[]; players: PlayerInfo[] }) {
  if (!awards.length) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">{t('reportUi.awards')}</h2>
      <div className="report-awards">
        {awards.map((a) => (
          <article key={a.playerId}>
            <AssetImage asset={`award_${a.code}`} fallback="★" />
            <h3>{t(`reportUi.award.${a.code}`)}</h3>
            <b>{players.find((p) => p.id === a.playerId)?.name ?? a.playerId}</b>
            <p>{t(`reportUi.award.${a.code}.why`)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
