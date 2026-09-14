import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const container = document.getElementById('root');

if (container) {
  const appElement = (
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );

  // If the server pre-rendered static HTML into #root, hydrate it smoothly
  if (container.hasChildNodes()) {
    hydrateRoot(container, appElement);
  } else {
    createRoot(container).render(appElement);
  }
}
