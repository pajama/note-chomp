// @vitest-environment jsdom
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createEmptySong, note } from '../core/model/factories';
import { serializeSong } from './notechomp/notechomp';
import { detectFormat, importSong } from './importSong';

const ABC = 'X:1\nT:Tiny\nM:4/4\nL:1/4\nK:C\nC D E F|\n';
const XML = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"/></part-list><part id="P1"><measure number="1">
<attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;

describe('detectFormat', () => {
  it('uses the file extension first', () => {
    const bytes = new Uint8Array();
    expect(detectFormat({ kind: 'file', name: 'a.MXL', bytes })).toBe('mxl');
    expect(detectFormat({ kind: 'file', name: 'a.musicxml', bytes })).toBe('musicxml');
    expect(detectFormat({ kind: 'file', name: 'a.xml', bytes })).toBe('musicxml');
    expect(detectFormat({ kind: 'file', name: 'a.notechomp.json', bytes })).toBe('notechomp');
    expect(detectFormat({ kind: 'file', name: 'a.abc', bytes })).toBe('abc');
  });
  it('sniffs pasted text', () => {
    expect(detectFormat({ kind: 'text', text: '  <?xml ...' })).toBe('musicxml');
    expect(detectFormat({ kind: 'text', text: '{"schemaVersion":1}' })).toBe('notechomp');
    expect(detectFormat({ kind: 'text', text: ABC })).toBe('abc');
  });
});

describe('importSong', () => {
  it('imports pasted ABC with a fresh id', () => {
    const result = importSong({ kind: 'text', text: ABC });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.song.id).not.toBe('imported');
  });

  it('gives an imported Note Chomp file a new id', () => {
    const original = { ...createEmptySong('Mine'), events: [note('C', 4, 'w')] };
    const result = importSong({
      kind: 'file',
      name: 'mine.notechomp.json',
      bytes: strToU8(serializeSong(original)),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.song.id).not.toBe(original.id);
      expect(result.song.events).toEqual(original.events);
    }
  });

  it('imports MusicXML text and .mxl archives', () => {
    expect(importSong({ kind: 'text', text: XML }).ok).toBe(true);
    const mxl = zipSync({ 'score.xml': strToU8(XML) });
    const result = importSong({ kind: 'file', name: 'score.mxl', bytes: mxl });
    expect(result.ok).toBe(true);
  });

  it('passes through failures', () => {
    expect(importSong({ kind: 'file', name: 'bad.mxl', bytes: new Uint8Array([0]) })).toEqual({
      ok: false,
      errors: [{ message: "This .mxl file couldn't be opened." }],
    });
  });
});
