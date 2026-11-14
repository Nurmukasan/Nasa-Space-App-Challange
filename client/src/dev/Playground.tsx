import { useState } from 'react';
import type { ReactNode } from 'react';
interface Entry {
  name: string;
  render: () => ReactNode;
}
const entries = Object.values(import.meta.glob<Entry>('./entries/*.tsx', { eager: true }));
/** Small routing bridge for B fixtures; additional C/B entries are discovered automatically. */
export function Playground({ name }: { name: string }) {
  const [selected, setSelected] = useState(name);
  const entry = entries.find((e) => e.name === selected);
  if (entry) return entry.render();
  return (
    <div className="screen">
      <h1>DEVELOPMENT PLAYGROUND</h1>
      {entries.map((e) => (
        <button key={e.name} onClick={() => setSelected(e.name)}>
          {e.name}
        </button>
      ))}
    </div>
  );
}
