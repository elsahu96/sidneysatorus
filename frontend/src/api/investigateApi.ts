import { ReportMetadata } from "@/types";
import { api } from "./client";
import { auth } from "@/firebase";

export const investigateApi = {
  start: (query: string, opts?: { signal?: AbortSignal; quickSearch?: boolean }) => {
    console.log("[investigate] req:", query, opts?.quickSearch ? "(quick)" : "");
    return api
      .post("/investigate", { query, quick_search: opts?.quickSearch ?? false }, { signal: opts?.signal })
      .then((r) => ({
        id: r.data.thread_id || r.data.id || r.data.task_id,
        status: r.data.status,
      }));
  },

  terminate: (taskId: string) =>
    api.delete(`/investigate/${taskId}`).then((r) => r.data),

  getReport: (reportId: string) =>
    api.get<ReportMetadata>(`/reports/${reportId}`).then((r) => {
      console.log("InvestigateApi: getReport: r:", r);
      return r.data;
    }),

  getStatus: (taskId: string) =>
    api.get(`/status/${taskId}`).then((r) => r.data),

  sendDecision: (threadId: string, decision: { approved: boolean; edited_content?: string; additional_urls?: string[] }) =>
    api.post(`/investigate/${threadId}/decision`, decision).then((r) => r.data),

  connectStatus: (
    taskId: string,
    onMessage: (data: any) => void,
    onError?: (err: Error) => void,
  ): { close: () => void } => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const streamUrl = `${apiUrl}/investigate/${taskId}/stream`;
    const controller = new AbortController();

    (async () => {
      try {
        const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
        const headers: Record<string, string> = { Accept: "text/event-stream" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(streamUrl, { headers, signal: controller.signal });
        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                onMessage(data);
              } catch {
                // ignore malformed SSE line
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const error = err instanceof Error ? err : new Error("Stream connection failed");
        console.error("[SSE] error:", error);
        onError?.(error);
      }
    })();

    return { close: () => controller.abort() };
  },
};
