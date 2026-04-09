import '@mantine/core/styles.css';
import { lazy, useEffect } from 'react';

import { setApiDefaults } from '../App';
import { Loadable } from '../functions/loading';
const DesktopAppView = Loadable(
  lazy(() => import('./DesktopAppView')),
  true,
  true
);

// Main App
export default function MainView() {
  // Set initial login status
  useEffect(() => {
    try {
      // Local state initialization
      setApiDefaults();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Main App component
  return <DesktopAppView />;
}
