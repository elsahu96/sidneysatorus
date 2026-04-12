import { api } from "./client";

export interface SessionRecord {
  id: string;
  userId: string | null;
  title: string;
  summary: string | null;
  blobPointer: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  /** TEXT = plain message; REPORT = investigation report (use reportRef for the full content) */
  messageType: "TEXT" | "REPORT";
  content: string;
  reportRef: string | null;
  tokenCount: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export const sessionApi = {
  list: (): Promise<SessionRecord[]> =>
    api.get<{ sessions: SessionRecord[] }>("/sessions/").then((r) => r.data.sessions),

  get: (id: string): Promise<SessionRecord> =>
    api.get<SessionRecord>(`/sessions/${id}`).then((r) => r.data),

  getContextWindow: (id: string): Promise<SessionMessage[]> =>
    api
      .get<{ session_id: string; messages: SessionMessage[] }>(`/sessions/${id}/context`)
      .then((r) => r.data.messages),

  create: (title: string): Promise<SessionRecord> =>
    api.post<SessionRecord>("/sessions/", { title }).then((r) => r.data),

  appendMessage: (
    sessionId: string,
    role: "USER" | "ASSISTANT",
    content: string,
    messageType: "TEXT" | "REPORT" = "TEXT",
    reportRef?: string,
    metadata?: Record<string, unknown>,
  ): Promise<SessionMessage> =>
    api
      .post<SessionMessage>(`/sessions/${sessionId}/messages`, {
        role,
        content,
        message_type: messageType,
        report_ref: reportRef ?? null,
        metadata: metadata ?? null,
      })
      .then((r) => r.data),

  delete: (id: string): Promise<void> =>
    api.delete(`/sessions/${id}`).then(() => undefined),

  archive: (id: string): Promise<{ blob_pointer: string }> =>
    api.post<{ blob_pointer: string }>(`/sessions/${id}/archive`).then((r) => r.data),
};
