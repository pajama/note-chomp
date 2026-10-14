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

/** Why the guard is asked: leaving the page, or starting over on #/new ("New song" while already there). */
export type LeaveReason = 'navigate' | 'new-song';

/**
 * Asked before the app follows a hash change (a link, Back/Forward, or navigate()). Returning
 * false keeps the current page and puts its address back. One guard at a time: the editor.
 */
export type NavigationGuard = (reason: LeaveReason) => boolean;

let guard: NavigationGuard | undefined;
let committedHash: string | undefined;
const listeners = new Set<() => void>();

export function setNavigationGuard(next: NavigationGuard): () => void {
  guard = next;
  return () => {
    if (guard === next) guard = undefined;
  };
}

/** Ask the current guard (if any) whether the page may be left for `reason`. */
export function confirmLeave(reason: LeaveReason): boolean {
  return guard ? guard(reason) : true;
}

/** The hash the app is showing — it lags window.location.hash until the guard has agreed. */
export function currentHash(): string {
  return committedHash ?? window.location.hash;
}

function onHashChange(): void {
  const next = window.location.hash;
  if (next === committedHash) return;
  if (guard && !guard('navigate')) {
    window.history.replaceState(window.history.state, '', committedHash || '#/');
    return;
  }
  committedHash = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToRoute(onChange: () => void): () => void {
  if (listeners.size === 0) {
    committedHash = window.location.hash;
    window.addEventListener('hashchange', onHashChange);
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      window.removeEventListener('hashchange', onHashChange);
      committedHash = undefined;
    }
  };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeToRoute, currentHash);
  return useMemo(() => parseHash(hash), [hash]);
}
