import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Never send errors or transcripts to a service. */
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>ÉCHO a besoin d’une pause.</h1>
        <p>
          Une erreur d’interface a interrompu l’affichage. Les séances déjà enregistrées restent
          locales.
        </p>
        <button onClick={() => location.reload()}>Recharger l’application</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
// No StrictMode: the exclusive editing lock must not be acquired twice during dev effect replay.
createRoot(document.getElementById('root')!).render(
  <AppBoundary>
    <App />
  </AppBoundary>,
);
