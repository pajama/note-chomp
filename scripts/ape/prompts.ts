import type { GenerateImageRequest } from './apeClient';

export interface ConceptPrompt {
  name: string;
  prompt: string;
  size: NonNullable<GenerateImageRequest['size']>;
}

const STYLE =
  "Flat vector sticker illustration for a children's music-learning worksheet. Thick rounded dark outlines, " +
  'bold simple shapes, minimal shading, friendly and cute, prints well on paper, centered on a plain ' +
  'transparent background.';
const NO_TEXT = 'No text, no letters, no numbers.';
const FRUITS =
  'a red apple, an orange, a yellow lemon, a green pear, a turquoise-blue blueberry, a bunch of purple grapes, and a pink raspberry';

export const CONCEPT_PROMPTS: ConceptPrompt[] = [
  {
    name: 'monster-round-chomper',
    prompt: `A round, friendly indigo-blue monster shaped like Pac-Man, seen from the side, with a wide open mouth facing to the RIGHT, ready to eat fruit. One big eye, two small cream horns, tiny feet, a few little white teeth, a pink tongue. ${STYLE} ${NO_TEXT}`,
    size: '1024x1024',
  },
  {
    name: 'monster-fuzzy-chomper',
    prompt: `A fuzzy, round, friendly indigo monster with a huge open mouth facing to the RIGHT like Pac-Man, eager to eat fruit, big happy eyes, small horns, stubby arms. ${STYLE} ${NO_TEXT}`,
    size: '1024x1024',
  },
  {
    name: 'monster-clef-chomper',
    prompt: `A cute monster whose curly body loosely echoes the shape of a treble clef (G clef) music symbol, with a big open mouth facing to the RIGHT ready to eat fruit, one big eye. ${STYLE} ${NO_TEXT}`,
    size: '1024x1536',
  },
  {
    name: 'fruit-lineup-solid',
    prompt: `Seven fruits in one horizontal row, evenly spaced, all the same size and roughly round so each fits in a circle: ${FRUITS}. ${STYLE} ${NO_TEXT}`,
    size: '1536x1024',
  },
  {
    name: 'fruit-lineup-outline',
    prompt: `Seven fruits in one horizontal row drawn as thick colored OUTLINES with a very pale tinted fill, like coloring-book shapes, all the same size: ${FRUITS}. ${STYLE} ${NO_TEXT}`,
    size: '1536x1024',
  },
  {
    name: 'worksheet-mockup',
    prompt: `A children's sheet-music worksheet: one large five-line music staff across the page. At the left end, a round friendly monster with its mouth open toward the right. Along the staff, colorful fruit sit on the lines and spaces like music notes: ${FRUITS}. ${STYLE}`,
    size: '1536x1024',
  },
];
