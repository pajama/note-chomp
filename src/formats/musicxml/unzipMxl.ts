import { strFromU8, unzipSync } from 'fflate';
import { err, ok, type Result } from '../../core/result';

export function extractMusicXmlFromMxl(bytes: Uint8Array): Result<string, string> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return err("This .mxl file couldn't be opened.");
  }
  const container = files['META-INF/container.xml'];
  let path = container ? /full-path="([^"]+)"/.exec(strFromU8(container))?.[1] : undefined;
  path ??= Object.keys(files).find(
    (name) => !name.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(name),
  );
  const file = path ? files[path] : undefined;
  if (!file) return err("This .mxl file doesn't contain a MusicXML score.");
  return ok(strFromU8(file));
}
