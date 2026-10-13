import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../../core/model/factories';
import { parseNoteChompJson, serializeSong } from './notechomp';

describe('NoteChomp JSON', () => {
  const song = {
    ...createEmptySong('Round Trip'),
    events: [note('G', 3, 'h', true), note('C', 6, 'q')],
  };

  it('round-trips a song', () => {
    const result = parseNoteChompJson(serializeSong(song));
    expect(result).toEqual({ ok: true, song, warnings: [] });
  });

  it('serializes as pretty JSON with a trailing newline', () => {
    const text = serializeSong(song);
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('\n  "title": "Round Trip"');
  });

  it('reports invalid JSON', () => {
    expect(parseNoteChompJson('{oops')).toEqual({
      ok: false,
      errors: [{ message: "This file isn't valid Note Chomp JSON." }],
    });
  });

  it('reports schema problems', () => {
    const result = parseNoteChompJson(JSON.stringify({ ...song, events: [note('F', 3, 'q')] }));
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          message:
            "Note 1: F3 is outside Note Chomp's range (the G below middle C up to high C, G3–C6).",
        },
      ],
    });
  });
});
