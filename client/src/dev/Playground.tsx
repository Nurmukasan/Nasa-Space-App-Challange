import type { ReactNode } from 'react';
import { t } from '../i18n';
export interface DevEntry {
  name: string;
  render: () => ReactNode;
}
const modules = import.meta.glob<{ default: DevEntry }>('./entries/*.tsx', { eager: true });
const entries = Object.values(modules).map((m) => m.default);
export function Playground({ name }: { name: string }) {
  const page = entries.find((entry) => entry.name === name);
  return page ? (
    page.render()
  ) : (
    <main className="screen">
      <h1>{t('dev.title')}</h1>
      <p>{t('dev.unknown', { name })}</p>
      {entries.map((entry) => (
        <a key={entry.name} href={`?dev=${encodeURIComponent(entry.name)}`}>
          {entry.name}
        </a>
      ))}
    </main>
  );
}
