import { useState } from 'react';
import { EditorPage } from './pages/EditorPage';
import { ImportPage } from './pages/ImportPage';
import { PrintPage } from './pages/PrintPage';
import { SongbookPage } from './pages/SongbookPage';
import { useRoute, type Route } from './router';

/**
 * A key for the editor that changes on every visit, except when the editor itself moves from
 * #/new (or a starter song) to #/edit/<id> after its first save: then the same editor stays
 * mounted, keeping undo history, cursor and note length.
 */
function useEditorKey(route: Route): { key: number; adopt: (id: string) => void } {
  const [prev, setPrev] = useState(route);
  const [key, setKey] = useState(0);
  const [adopted, setAdopted] = useState<string | null>(null);
  if (route !== prev) {
    setPrev(route);
    const keep =
      route.name === 'edit' &&
      route.id === adopted &&
      (prev.name === 'new' || prev.name === 'edit');
    if (!keep) setKey((k) => k + 1);
    setAdopted(null);
  }
  return { key, adopt: setAdopted };
}

function RouteView({ route }: { route: Route }) {
  const editor = useEditorKey(route);
  switch (route.name) {
    case 'songbook':
      return <SongbookPage />;
    case 'new':
      return <EditorPage key={editor.key} onSavedAs={editor.adopt} />;
    case 'edit':
      return <EditorPage key={editor.key} songId={route.id} onSavedAs={editor.adopt} />;
    case 'import':
      return <ImportPage />;
    case 'print':
      return <PrintPage key={route.id} songId={route.id} />;
    case 'notFound':
      return (
        <section className="panel">
          <h1>Page not found</h1>
          <p>
            <a href="#/">Back to the songbook</a>
          </p>
        </section>
      );
  }
}

export function App() {
  const route = useRoute();
  const inEditor = route.name === 'new' || route.name === 'edit';
  return (
    <div className={inEditor ? 'app app-editor' : 'app'}>
      <header className="app-header no-print">
        <a href="#/" className="brand">
          Note Chomp
        </a>
        <nav>
          <a href="#/new" className="button">
            New song
          </a>
          <a href="#/import" className="button secondary">
            Import
          </a>
        </nav>
      </header>
      <main className="app-main">
        <RouteView route={route} />
      </main>
    </div>
  );
}
