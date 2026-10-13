import { useMemo, useSyncExternalStore } from 'react';

export type Route =
  | { name: 'songbook' }
  | { name: 'new' }
  | { name: 'edit'; id: string }
  | { name: 'import' }
  | { name: 'print'; id: string }
  | { name: 'notFound' };

export function parseHash(hash: string): Route {
  let parts: string[];
  try {
    parts = hash.replace(/^#/, '').split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    return { name: 'notFound' };
  }
  const [head, id] = parts;
  if (parts.length === 0) return { name: 'songbook' };
  if (parts.length === 1 && head === 'new') return { name: 'new' };
  if (parts.length === 1 && head === 'import') return { name: 'import' };
  if (parts.length === 2 && head === 'edit' && id) return { name: 'edit', id };
  if (parts.length === 2 && head === 'print' && id) return { name: 'print', id };
  return { name: 'notFound' };
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'songbook':
    case 'notFound':
      return '#/';
    case 'new':
      return '#/new';
    case 'import':
      return '#/import';
    case 'edit':
      return `#/edit/${encodeURIComponent(route.id)}`;
    case 'print':
      return `#/print/${encodeURIComponent(route.id)}`;
  }
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return useMemo(() => parseHash(hash), [hash]);
}
