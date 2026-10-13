# Phase 1 — Foundation

### Task 1: Scaffold, tooling, secrets, CI

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `index.html`, `playwright.config.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/core/result.ts`, `src/core/result.test.ts`, `.env`, `.env.example`, `.github/workflows/ci.yml`
- Modify: `.gitignore`
- Delete: `ape.key` (after migrating it to `.env`)

**Interfaces:**
- Produces: `Result<T, E>`, `ok(value)`, `err(error)` from `src/core/result.ts`; npm scripts `dev`, `build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:watch`, `test:e2e`, `ape:concepts`.

- [ ] **Step 1: Migrate the APE key into `.env` and harden `.gitignore`**

```bash
cd /Users/kevinarbor/Documents/note-chomp
printf 'APE_KEY=%s\n' "$(tr -d '\n\r ' < ape.key)" > .env
printf '# Copy to .env and fill in. Never commit .env.\nAPE_KEY=\n' > .env.example
chmod 600 .env
grep -Eq '^APE_KEY=.+' .env && rm ape.key
cat > .gitignore <<'EOF'
# secrets
ape.key
.env
.env.*
!.env.example

# deps / build
node_modules/
dist/

# test output
coverage/
playwright-report/
test-results/

# generated art explorations (review, then copy chosen assets into src/)
art-concepts/

# local reference material
ape-docs.json

.DS_Store
EOF
```

Expected: `.env` contains `APE_KEY=<value>` and is mode `-rw-------`, `ape.key` is gone, `git status` does not list `.env`.

- [ ] **Step 2: Create `package.json` and install dependencies**

```json
{
  "name": "note-chomp",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test --pass-with-no-tests",
    "ape:concepts": "tsx scripts/ape/generate-concepts.ts"
  }
}
```

```bash
npm install react react-dom zod jspdf svg2pdf.js fflate
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/node \
  vitest jsdom @playwright/test tsx \
  eslint @eslint/js typescript-eslint eslint-plugin-react-hooks globals prettier
```

- [ ] **Step 3: TypeScript, Vite, Prettier, Playwright config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  // Only VITE_* variables may ever reach the browser bundle; APE_KEY must never be exposed.
  envPrefix: 'VITE_',
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
```

`.prettierrc.json`:

```json
{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore`:

```
dist
node_modules
playwright-report
test-results
art-concepts
docs
coverage
package-lock.json
ape-docs.json
*.abc
**/__snapshots__
```

`playwright.config.ts` (the e2e harness exists from the start; specs arrive in Task 22 — until then `test:e2e` passes with `--pass-with-no-tests`):

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 5179;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 4: ESLint flat config with layer boundaries**

Flat config is "last matching block wins" per rule: if two blocks both set `no-restricted-imports` for the same file, only the later one applies. So every file under `src/` matches **exactly one** layer block (the catch-all `src/**` block `ignores` the five layer folders), and each layer block repeats the shared `scripts` and `process.env` bans.

`eslint.config.js`:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const SCRIPTS = ['**/scripts', '**/scripts/**'];
const REACT = ['react', 'react-dom', 'react-dom/*'];
const layer = (names) => names.flatMap((n) => [`**/${n}`, `**/${n}/**`]);

const forbid = (patterns) => ({
  'no-restricted-imports': ['error', { patterns: patterns.map((group) => ({ group: [group] })) }],
  'no-restricted-properties': [
    'error',
    { object: 'process', property: 'env', message: 'No env access in src/' },
  ],
});

const LAYERS = ['src/core/**', 'src/formats/**', 'src/render/**', 'src/export/**', 'src/persistence/**'];
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
  { ignores: ['dist', 'playwright-report', 'test-results', 'art-concepts', 'coverage'] },
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
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      ...forbid([
        ...REACT,
        ...layer(['formats', 'render', 'export', 'persistence', 'app', 'songs']),
        ...SCRIPTS,
      ]),
      'no-restricted-globals': ['error', ...DOM_GLOBALS],
    },
  },
  {
    files: ['src/formats/**/*.{ts,tsx}'],
    rules: forbid([
      ...REACT,
      ...layer(['render', 'export', 'persistence', 'app', 'songs']),
      ...SCRIPTS,
    ]),
  },
  {
    files: ['src/render/**/*.{ts,tsx}'],
    rules: forbid([...layer(['app', 'persistence', 'export', 'formats', 'songs']), ...SCRIPTS]),
  },
  {
    files: ['src/export/**/*.{ts,tsx}'],
    rules: forbid([...layer(['app', 'persistence', 'songs', 'formats']), ...SCRIPTS]),
  },
  {
    files: ['src/persistence/**/*.{ts,tsx}'],
    rules: forbid([...REACT, ...layer(['app', 'render', 'export', 'songs']), ...SCRIPTS]),
  },
);
```

(`crypto` stays allowed in `core` — `newSongId` uses `crypto.randomUUID`.)

- [ ] **Step 4b: Prove the layer rules are enforced**

A rule that silently never fires is worse than none. Each probe file below must make ESLint report the named rule; the loop prints `ENFORCED` or `NOT ENFORCED` for each and deletes the probe.

```bash
probe() { # probe <file> <rule> <source>
  mkdir -p "$(dirname "$1")"; printf '%s\n' "$3" > "$1"
  if npx eslint "$1" 2>/dev/null | grep -q "$2"; then echo "ENFORCED     $1"; else echo "NOT ENFORCED $1"; fi
  rm "$1"
}
probe src/core/__probe.ts no-restricted-imports "import 'react';"
probe src/core/__probe2.ts no-restricted-imports "import '../render/svg/PageSvg';"
probe src/core/__probe3.ts no-restricted-globals "export const w = window.innerWidth;"
probe src/formats/__probe.ts no-restricted-imports "import '../persistence/draft';"
probe src/render/__probe.ts no-restricted-imports "import '../app/App';"
probe src/persistence/__probe.ts no-restricted-imports "import 'react';"
probe src/app/__probe.ts no-restricted-imports "import '../../scripts/ape/apeClient';"
probe src/app/__probe2.ts no-restricted-properties "export const k = process.env.APE_KEY;"
```

Expected: eight `ENFORCED` lines and no `NOT ENFORCED`. Then `ls src/core src/app` shows no `__probe*` files. In particular `npx eslint src/core/__probe.ts` with `import 'react';` must **fail** — if it passes, a later block is overriding the core block.

- [ ] **Step 5: Write the failing test for `Result` helpers**

`src/core/result.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { err, ok } from './result';

describe('Result helpers', () => {
  it('ok wraps a value', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });
  it('err wraps an error', () => {
    expect(err('nope')).toEqual({ ok: false, error: 'nope' });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run src/core/result.test.ts`
Expected: FAIL — cannot resolve `./result`.

- [ ] **Step 7: Implement `src/core/result.ts`**

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
export const err = <E>(error: E): { ok: false; error: E } => ({ ok: false, error });
```

- [ ] **Step 8: App entry placeholder**

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Note Chomp</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/app/App.tsx` (replaced in Task 22):

```tsx
export function App() {
  return <h1>Note Chomp</h1>;
}
```

`src/main.tsx` (replaced in Task 22):

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 9: CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - name: The APE key never reaches the bundle
        run: '! grep -rq APE_KEY dist'
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 10: Verify everything passes**

Run: `npm run format && npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run build && ! grep -rq APE_KEY dist`
Expected: Prettier reports all files formatted, lint clean, typecheck clean, 2 tests pass, `test:e2e` exits 0 with no tests found, `dist/` built and free of `APE_KEY`.

Run: `git status --short`
Expected: `.env` and `ape.key` NOT listed; `ape-docs.json` NOT listed.

- [ ] **Step 11: Commit**

```bash
git add .gitignore .env.example package.json package-lock.json tsconfig.json vite.config.ts \
  eslint.config.js .prettierrc.json .prettierignore playwright.config.ts index.html src .github
git commit -m "chore: scaffold Vite + React + TS app with lint, tests, CI; move APE key to .env"
```
