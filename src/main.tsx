import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onRegisterError() {
        // Non-fatal in restricted embedded frames
      },
    });
  } else {
    const hadController = Boolean(navigator.serviceWorker.controller);
    Promise.all([
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister()))),
      'caches' in window
        ? caches.delete('app-shell-modules-cache')
        : Promise.resolve(false),
    ])
      .then(([unregistered]) => {
        const unregisteredAny =
          Array.isArray(unregistered) && unregistered.some(Boolean);
        if (
          (hadController || unregisteredAny) &&
          !sessionStorage.getItem('sw_dev_cleaned')
        ) {
          sessionStorage.setItem('sw_dev_cleaned', '1');
          window.location.reload();
        }
      })
      .catch(() => {
        // Non-fatal in restricted embedded frames
      });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
