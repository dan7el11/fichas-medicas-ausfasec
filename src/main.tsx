import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// PWA: registrar el service worker solo en producción (en desarrollo estorba)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* sin PWA, la app funciona igual */ });
  });
}

/**
 * La app se parte en varios archivos que se piden al usarlos (el visor de
 * PDF, la ficha en Excel, los catálogos). Tras una actualización, una pestaña
 * que lleva tiempo abierta sigue pidiendo los archivos de la versión anterior,
 * que ya no están en el servidor: la importación falla y el botón que la
 * disparó se queda sin hacer nada, sin ningún aviso.
 *
 * Vite avisa de ese caso con `vite:preloadError`. Se recarga una sola vez por
 * pestaña: la marca vive en sessionStorage y no se limpia, así que si tras
 * recargar vuelve a fallar es otro problema y se deja salir el error en lugar
 * de recargar en bucle.
 */
window.addEventListener('vite:preloadError', (event) => {
  const MARCA = 'recarga-por-version';
  if (sessionStorage.getItem(MARCA)) return;   // ya se intentó: que salte el error normal
  event.preventDefault();
  sessionStorage.setItem(MARCA, '1');
  window.location.reload();
});

const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
