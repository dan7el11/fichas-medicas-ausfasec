import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="bg-white border border-red-200 rounded-2xl shadow-sm p-8 max-w-lg w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Ocurrió un error inesperado</h1>
          <p className="text-sm text-slate-500 mb-4">
            La aplicación encontró un problema y no pudo continuar. Puedes intentar recargar la página.
          </p>
          <details className="text-left bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-xs text-slate-600 cursor-pointer">
            <summary className="font-semibold text-slate-700 mb-1">Detalles del error</summary>
            <pre className="mt-2 whitespace-pre-wrap break-all">{error.message}</pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm cursor-pointer"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }
}
