'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) => registration.active?.scriptURL.endsWith('/sw.js'))
              .map((registration) => registration.unregister()),
          ),
        )
        .catch((error) => {
          console.log('Service Worker cleanup failed:', error);
        });
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    void navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);

        intervalId = setInterval(() => {
          void registration.update();
        }, 60000);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return null;
}
