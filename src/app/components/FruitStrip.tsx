import type { Note, Song } from '../../core/model/types';
import { FruitArt } from '../../render/art/fruits';

export function FruitStrip({ song, max = 10 }: { song: Song; max?: number }) {
  const notes = song.events.filter((e): e is Note => e.kind === 'note').slice(0, max);
  return (
    <svg className="fruit-strip" viewBox={`0 0 ${Math.max(notes.length, 1)} 1`} aria-hidden="true">
      {notes.map((n, i) => (
        <g key={i} transform={`translate(${i + 0.5} 0.5) scale(0.85)`}>
          <FruitArt pitch={n.pitch} hollow={n.duration === 'h' || n.duration === 'w'} />
        </g>
      ))}
    </svg>
  );
}
