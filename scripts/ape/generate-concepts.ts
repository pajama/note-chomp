import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { generateImage, type GenerateImageRequest } from './apeClient';
import { CONCEPT_PROMPTS } from './prompts';

function loadApiKey(): string {
  try {
    process.loadEnvFile('.env');
  } catch {
    // .env is optional if APE_KEY is already in the environment.
  }
  const key = process.env.APE_KEY;
  if (!key) {
    console.error('APE_KEY is not set. Add it to .env (see .env.example).');
    process.exit(1);
  }
  return key;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      model: { type: 'string', default: 'gpt-image-1.5' },
      quality: { type: 'string', default: 'low' },
      only: { type: 'string' },
      out: { type: 'string', default: 'art-concepts' },
    },
  });
  const apiKey = loadApiKey();
  const model = values.model ?? 'gpt-image-1.5';
  const quality = (values.quality ?? 'low') as NonNullable<GenerateImageRequest['quality']>;
  const prompts = values.only
    ? CONCEPT_PROMPTS.filter((p) => p.name.includes(values.only ?? ''))
    : CONCEPT_PROMPTS;
  if (prompts.length === 0) {
    console.error(
      `No prompts match "${values.only}". Names: ${CONCEPT_PROMPTS.map((p) => p.name).join(', ')}`,
    );
    process.exit(1);
  }

  const dir = path.resolve(
    values.out ?? 'art-concepts',
    new Date().toISOString().replace(/[:.]/g, '-'),
  );
  await mkdir(dir, { recursive: true });

  let failures = 0;
  for (const p of prompts) {
    process.stdout.write(`→ ${p.name} (${model}) … `);
    try {
      const png = await generateImage({ apiKey, model, prompt: p.prompt, size: p.size, quality });
      const file = path.join(dir, `${p.name}.png`);
      await writeFile(file, png);
      console.log(`saved ${path.relative(process.cwd(), file)}`);
    } catch (e) {
      failures++;
      console.log(`failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await writeFile(
    path.join(dir, 'prompts.json'),
    `${JSON.stringify({ model, quality, prompts }, null, 2)}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

void main();
