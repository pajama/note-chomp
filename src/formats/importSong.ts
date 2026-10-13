import { newSongId } from '../core/model/id';
import { parseAbc } from './abc/parseAbc';
import { extractMusicXmlFromMxl } from './musicxml/unzipMxl';
import { parseMusicXml } from './musicxml/parseMusicXml';
import { parseNoteChompJson } from './notechomp/notechomp';
import { importFailure, type ImportResult } from './types';

export type ImportSource =
  { kind: 'text'; text: string } | { kind: 'file'; name: string; bytes: Uint8Array };
export type DetectedFormat = 'abc' | 'musicxml' | 'mxl' | 'notechomp';

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

export function detectFormat(source: ImportSource): DetectedFormat {
  if (source.kind === 'file') {
    const name = source.name.toLowerCase();
    if (name.endsWith('.mxl')) return 'mxl';
    if (name.endsWith('.musicxml') || name.endsWith('.xml')) return 'musicxml';
    if (name.endsWith('.json')) return 'notechomp';
    if (name.endsWith('.abc')) return 'abc';
  }
  const text = (source.kind === 'text' ? source.text : decode(source.bytes)).trimStart();
  if (text.startsWith('<')) return 'musicxml';
  if (text.startsWith('{')) return 'notechomp';
  return 'abc';
}

export function importSong(source: ImportSource): ImportResult {
  const format = detectFormat(source);
  let result: ImportResult;
  if (format === 'mxl' && source.kind === 'file') {
    const extracted = extractMusicXmlFromMxl(source.bytes);
    result = extracted.ok ? parseMusicXml(extracted.value) : importFailure([extracted.error]);
  } else {
    const text = source.kind === 'text' ? source.text : decode(source.bytes);
    result =
      format === 'musicxml'
        ? parseMusicXml(text)
        : format === 'notechomp'
          ? parseNoteChompJson(text)
          : parseAbc(text);
  }
  return result.ok ? { ...result, song: { ...result.song, id: newSongId() } } : result;
}
