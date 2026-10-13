import { Component, type ErrorInfo, type ReactNode } from 'react';
import { slugify } from '../../core/text';
import { NOTECHOMP_EXTENSION, serializeSong } from '../../formats/notechomp/notechomp';
import { loadDraft } from '../../persistence/draft';
import type { KeyValueStorage } from '../../persistence/SongRepository';
import { downloadText } from '../download';

interface Props {
  storage: KeyValueStorage;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Note Chomp crashed', error, info.componentStack);
  }

  private downloadDraft = () => {
    const draft = loadDraft(this.props.storage);
    if (draft)
      downloadText(
        `${slugify(draft.title)}${NOTECHOMP_EXTENSION}`,
        serializeSong(draft),
        'application/json',
      );
  };

  private goHome = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  override render() {
    if (!this.state.error) return this.props.children;
    const hasDraft = loadDraft(this.props.storage) !== undefined;
    return (
      <main className="crash" role="alert">
        <h1>Oops! The monster has a tummy ache.</h1>
        <p>Something went wrong. Your saved songs are safe.</p>
        {hasDraft && (
          <button type="button" onClick={this.downloadDraft}>
            Download the song you were editing
          </button>
        )}
        <button type="button" onClick={this.goHome}>
          Back to the songbook
        </button>
      </main>
    );
  }
}
