import { EditorPage } from './pages/EditorPage';
import { ImportPage } from './pages/ImportPage';
import { PrintPage } from './pages/PrintPage';
import { SongbookPage } from './pages/SongbookPage';
import { useRoute, type Route } from './router';

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case 'songbook':
      return <SongbookPage />;
    case 'new':
      return <EditorPage key="new" />;
    case 'edit':
      return <EditorPage key={route.id} songId={route.id} />;
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
  return (
    <div className="app">
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
