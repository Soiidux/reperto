import { useCallback, useState } from "react";
import { getClinicSettings, type ClinicSettings } from "@/api/clinic";
import { useVisibilityPolling } from "@/hooks/use-visibility-polling";

// The live open/closed badge must flip on its own when the clinic closes, so
// the settings are re-read on a timer instead of being fetched once and left
// stale. Polling pauses while the tab is hidden and refreshes on return.
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Public clinic settings (name, contact, hours) plus the server-computed
 * "open right now" state. No auth required.
 */
export const useClinicSettings = () => {
  const [clinic, setClinic] = useState<ClinicSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await getClinicSettings();
      setClinic(response.data?.success ? response.data?.data ?? null : null);
    } catch {
      setClinic(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useVisibilityPolling(refresh, REFRESH_INTERVAL_MS);

  return { clinic, isLoading, refresh };
};
