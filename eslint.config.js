import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const SCRIPTS = ['**/scripts', '**/scripts/**'];
const REACT = ['react', 'react-dom', 'react-dom/*'];
const TONE = ['tone', 'tone/*'];
const layer = (names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);

const forbid = (patterns) => ({
  'no-restricted-imports': ['error', { patterns: patterns.map((group) => ({ group: [group] })) }],
  'no-restricted-properties': [
    'error',
    { object: 'process', property: 'env', message: 'No env access in src/' },
  ],
});

const LAYERS = [
  'src/core/**',
  'src/formats/**',
  'src/render/**',
  'src/export/**',
  'src/persistence/**',
  'src/audio/**',
];
const DOM_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'DOMParser',
  'Element',
  'HTMLElement',
  'Blob',
  'URL',
].map((name) => ({ name, message: 'src/core must stay free of browser APIs.' }));

export default tseslint.config(
  {
    ignores: [
      'dist',
      'playwright-report',
      'test-results',
      'art-concepts',
      'coverage',
      '.superpowers',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  // app, songs, main.tsx: may import every layer, but never scripts/ or env.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: LAYERS,
    rules: forbid(SCRIPTS),
  },
  // Only src/audio and src/app may touch Tone.js.
  {
    files: ['src/songs/**/*.{ts,tsx}', 'src/main.tsx'],
    rules: forbid([...TONE, ...SCRIPTS]),
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      ...forbid([
        ...REACT,
        ...layer(['formats', 'render', 'export', 'persistence', 'app', 'songs', 'audio']),
        ...TONE,
        ...SCRIPTS,
      ]),
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
    },
  },
  {
    files: ['src/formats/**/*.{ts,tsx}'],
    rules: forbid([
      ...REACT,
      ...layer(['render', 'export', 'persistence', 'app', 'songs', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  {
    files: ['src/render/**/*.{ts,tsx}'],
    rules: forbid([
      ...layer(['app', 'persistence', 'export', 'formats', 'songs', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  {
    files: ['src/export/**/*.{ts,tsx}'],
    rules: forbid([
      ...layer(['app', 'persistence', 'songs', 'formats', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  {
    files: ['src/persistence/**/*.{ts,tsx}'],
    rules: forbid([
      ...REACT,
      ...layer(['app', 'render', 'export', 'songs', 'audio']),
      ...TONE,
      ...SCRIPTS,
    ]),
  },
  // audio: Tone.js + core only.
  {
    files: ['src/audio/**/*.{ts,tsx}'],
    rules: forbid([
      ...REACT,
      ...layer(['formats', 'render', 'export', 'persistence', 'app', 'songs']),
      ...SCRIPTS,
    ]),
  },
);
