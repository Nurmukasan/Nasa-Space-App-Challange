import type { ReactNode } from 'react';
import { t } from '../i18n';
export interface DevEntry {
  name: string;
  render: () => ReactNode;
}
type EntryModule = Partial<DevEntry> & { default?: DevEntry };
const modules = import.meta.glob<EntryModule>('./entries/*.tsx', { eager: true });
// B pages use named exports; C pages may export the same entry as default.
const entries = Object.values(modules)
  .map((module) => module.default ?? module)
  .filter(
    (entry): entry is DevEntry =>
      typeof entry.name === 'string' && typeof entry.render === 'function',
  )
  .sort((a, b) => a.name.localeCompare(b.name));
export function Playground({ name }: { name: string }) {
  const entry = entries.find((page) => page.name === name);
  if (entry) return entry.render();
  return (
    <main className="screen">
      <h1>{t('dev.title')}</h1>
      <p>{name ? t('dev.unknown', { name }) : t('dev.empty')}</p>
      <nav aria-label={t('dev.title')}>
        {entries.map((page) => (
          <a key={page.name} href={`?dev=${encodeURIComponent(page.name)}`}>
            {page.name}
          </a>
        ))}
      </nav>
    </main>
  );
}
