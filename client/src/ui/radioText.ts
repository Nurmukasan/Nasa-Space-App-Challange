import type { LogEntry, PlayerInfo } from '@rs/shared';
import { t } from '../i18n';

/** Radio voices with their own label; 'sys' lines come from the onboard computer. */
const VOICES = ['earth', 'tulpar', 'mc'] as const;
export type RadioVoice = (typeof VOICES)[number] | 'crew';

export function radioVoice(from: string): RadioVoice {
  if (from === 'sys') return 'tulpar';
  return (VOICES as readonly string[]).includes(from) ? (from as RadioVoice) : 'crew';
}

/**
 * Text of a radio line. The engine refers to crew by player id (`{id}`); players must see the
 * call sign instead, on the helmet HUD and on the console alike.
 */
export function radioText(entry: LogEntry, roster: readonly PlayerInfo[] | undefined): string {
  const params = entry.params ? { ...entry.params } : undefined;
  if (params && typeof params.id === 'string')
    params.id = roster?.find((p) => p.id === params.id)?.name ?? params.id;
  return t(entry.key, params);
}
