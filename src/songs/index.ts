import type { Song } from '../core/model/types';
import { parseAbc } from '../formats/abc/parseAbc';

const sources = import.meta.glob<string>('./*.abc', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const BUILTIN_PREFIX = 'builtin-';

export const isBuiltinId = (id: string): boolean => id.startsWith(BUILTIN_PREFIX);

export const BUNDLED_SONGS: Song[] = Object.keys(sources)
  .sort()
  .map((path) => {
    const result = parseAbc(sources[path]);
    if (!result.ok) {
      throw new Error(
        `Bundled song ${path} is invalid: ${result.errors.map((e) => e.message).join('; ')}`,
      );
    }
    const slug = path.replace(/^\.\//, '').replace(/\.abc$/, '');
    return { ...result.song, id: `${BUILTIN_PREFIX}${slug}` };
  });
