import { auth } from "@/firebase";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Parsed result from the quick-search stream. */
export interface QuickSearchReport {
  content: string;
  geolocations: [];
  references: [];
}

/**
 * Stream a quick AI answer from the backend (single-model, no multi-agent
 * pipeline). The backend emits SSE events:
 *
 *   {"type": "chunk", "text": "..."}  — incremental markdown text
 *   {"type": "done"}                  — stream complete
 *   {"type": "error", "detail": "..."} — server error
 *
 * @param query    The user's question
 * @param onStatus Called with each progress string while waiting
 * @param onDone   Called when the stream finishes; receives accumulated content
 * @param onError  Called on network or server error
 * @param signal   Optional AbortSignal to cancel mid-stream
 */
export async function streamQuickSearch(
  query: string,
  onStatus: (text: string) => void,
  onDone: (report?: QuickSearchReport) => void,
  onError: (detail: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : "";

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/quick_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query }),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    onError(err instanceof Error ? err.message : "Network error");
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    onError(`Server error ${response.status}: ${text}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    onError("No response body from server");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let accumulated = "";
  let receivedFirstChunk = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event: { type: string; text?: string; detail?: string };
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }

        if (event.type === "chunk" && event.text) {
          accumulated += event.text;
          if (!receivedFirstChunk) {
            receivedFirstChunk = true;
            onStatus("Generating response…");
          }
        } else if (event.type === "done") {
          onDone(
            accumulated
              ? { content: accumulated, geolocations: [], references: [] }
              : undefined,
          );
          return;
        } else if (event.type === "error") {
          onError(event.detail ?? "Unknown error");
          return;
        }
      }
    }

    onDone(
      accumulated
        ? { content: accumulated, geolocations: [], references: [] }
        : undefined,
    );
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      onError(err instanceof Error ? err.message : "Stream interrupted");
    }
  } finally {
    reader.releaseLock();
  }
}
