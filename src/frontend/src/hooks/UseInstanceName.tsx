import { useMemo } from 'react';

import {
  DEFAULT_SYSTEM_NAME,
  resolveSystemDisplayName
} from '../defaults/branding';
import { useGlobalSettingsState } from '../states/SettingsStates';

/**
 * Simple hook for returning the "instance name" of the Server
 */
export default function useInstanceName(): string {
  const globalSettings = useGlobalSettingsState();

  return useMemo(() => {
    return resolveSystemDisplayName(
      globalSettings.getSetting('INVENTREE_INSTANCE', DEFAULT_SYSTEM_NAME)
    );
  }, [globalSettings]);
}
