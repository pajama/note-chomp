import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { extractMusicXmlFromMxl } from './unzipMxl';

describe('extractMusicXmlFromMxl', () => {
  it('follows META-INF/container.xml to the root file', () => {
    const zip = zipSync({
      'META-INF/container.xml': strToU8(
        '<container><rootfiles><rootfile full-path="score/song.xml"/></rootfiles></container>',
      ),
      'score/song.xml': strToU8('<score-partwise/>'),
    });
    expect(extractMusicXmlFromMxl(zip)).toEqual({ ok: true, value: '<score-partwise/>' });
  });

  it('falls back to the first .musicxml file', () => {
    const zip = zipSync({ 'song.musicxml': strToU8('<score-partwise/>') });
    expect(extractMusicXmlFromMxl(zip)).toEqual({ ok: true, value: '<score-partwise/>' });
  });

  it('reports a broken archive', () => {
    expect(extractMusicXmlFromMxl(new Uint8Array([1, 2, 3]))).toEqual({
      ok: false,
      error: "This .mxl file couldn't be opened.",
    });
  });
});
