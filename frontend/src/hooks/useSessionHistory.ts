import { useEffect, useState, useCallback } from "react";
import { sessionApi, type SessionRecord, type SessionMessage } from "@/api/sessionApi";

export interface UseSessionHistoryReturn {
  sessions: SessionRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Fetch and return the context window for a session. */
  loadMessages: (sessionId: string) => Promise<SessionMessage[]>;
}

export function useSessionHistory(): UseSessionHistoryReturn {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    sessionApi
      .list()
      .then((data) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        if (cancelled) return;
        // Gracefully degrade on DB unavailable (503) or unauthenticated (401/403) —
        // these are expected in local dev without Cloud SQL Auth Proxy and during
        // initial page load before the Firebase token is ready.
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 503 || status === 401 || status === 403) {
          setSessions([]);
        } else {
          setError(err instanceof Error ? err.message : "Failed to load sessions");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const loadMessages = useCallback(
    (sessionId: string) => sessionApi.getContextWindow(sessionId),
    [],
  );

  return { sessions, loading, error, refresh, loadMessages };
}
