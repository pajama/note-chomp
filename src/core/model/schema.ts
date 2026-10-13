import { z } from 'zod';
import { err, ok, type Result } from '../result';
import { isInRange, RANGE_LABEL } from '../theory/pitch';
import { splitIntoMeasures } from '../theory/rhythm';
import { DURATIONS, PITCHES, TIME_SIGNATURES, type Song } from './types';

export const MAX_TITLE_LENGTH = 100;
export const MAX_EVENTS = 2000;

const durationSchema = z.enum(DURATIONS);

const noteSchema = z.object({
  kind: z.literal('note'),
  pitch: z.enum(PITCHES),
  octave: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  duration: durationSchema,
  dotted: z.boolean().optional(),
});

const restSchema = z.object({
  kind: z.literal('rest'),
  duration: durationSchema,
  dotted: z.boolean().optional(),
});

export const songSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    title: z
      .string()
      .trim()
      .min(1, 'Give the song a title.')
      .max(
        MAX_TITLE_LENGTH,
        `The title is too long — keep it to ${MAX_TITLE_LENGTH} characters or fewer.`,
      ),
    timeSignature: z.enum(TIME_SIGNATURES),
    events: z
      .array(z.discriminatedUnion('kind', [noteSchema, restSchema]))
      .max(
        MAX_EVENTS,
        `This song is too long — Note Chomp songs can have up to ${MAX_EVENTS} notes and rests.`,
      ),
  })
  .superRefine((song, ctx) => {
    song.events.forEach((event, i) => {
      if (event.kind === 'note' && !isInRange(event.pitch, event.octave)) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', i],
          message: `Note ${i + 1}: ${event.pitch}${event.octave} is outside Note Chomp's range (the G below middle C up to high C, ${RANGE_LABEL}).`,
        });
      }
    });
    const measures = splitIntoMeasures(song.events, song.timeSignature);
    if (!measures.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['events', measures.error.eventIndex],
        message: measures.error.message,
      });
    }
  });

export interface ValidationIssue {
  path: (string | number)[];
  message: string;
}

export function validateSong(input: unknown): Result<Song, ValidationIssue[]> {
  const parsed = songSchema.safeParse(input);
  if (parsed.success) return ok(parsed.data satisfies Song);
  return err(
    parsed.error.issues.map((issue) => ({
      path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
      message: issue.message,
    })),
  );
}
