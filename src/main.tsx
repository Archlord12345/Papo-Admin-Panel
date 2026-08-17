import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

type ErrorBoundaryState = { error: Error | null };

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PAPO panel runtime error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="error-screen">
        <section className="error-card" role="alert">
          <p className="error-eyebrow">PAPO · ADMINISTRATION</p>
          <h1>Le panel n’a pas pu s’afficher</h1>
          <p>{this.state.error.message || 'Une erreur inattendue est survenue.'}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Recharger le panel</button>
        </section>
      </main>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
