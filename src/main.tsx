import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { ServicesProvider, type Services } from './app/services';
import './app/styles.css';
import { LocalStorageSongRepository } from './persistence/LocalStorageSongRepository';
import { safeLocalStorage } from './persistence/memoryStorage';

const storage = safeLocalStorage();
const services: Services = { repository: new LocalStorageSongRepository(storage), storage };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={services}>
      <ErrorBoundary storage={storage}>
        <App />
      </ErrorBoundary>
    </ServicesProvider>
  </StrictMode>,
);
