import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
export function usePwa() {
  const [installEvent, setInstallEvent] = useState<InstallEvent>(),
    [shellCached, setShellCached] = useState(false),
    [error, setError] = useState('');
  const {
    needRefresh: [needsUpdate],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onOfflineReady: () => setShellCached(true),
    onRegisterError: () =>
      setError('La mise en cache de l’application a échoué. Le mode hors ligne n’est pas garanti.'),
  });
  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    // A controlling active SW means the app shell was precached successfully on an earlier visit.
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .getRegistration()
        .then((reg) => {
          if (reg?.active && navigator.serviceWorker.controller) setShellCached(true);
        })
        .catch(() => undefined);
    return () => window.removeEventListener('beforeinstallprompt', beforeInstall);
  }, []);
  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(undefined);
  }
  return {
    installable: Boolean(installEvent),
    install,
    shellCached,
    needsUpdate,
    update: () => updateServiceWorker(true),
    error,
  };
}
