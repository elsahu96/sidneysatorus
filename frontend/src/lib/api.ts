import axios from "axios";
import type { ReportMetadata } from "@/types/index";
import { auth } from "@/firebase";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create axios instance
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const apiClient = {
  
  // getUser: (id: string) => {
  //   return api.get<{ user: User }>(`/user/profile/${id}`);
  // },
  // updateUser: (id: string, data: Partial<User>) => {
  //   return api.put<{ user: User }>(`/user/profile/${id}`, data);
  // },
  /** Query the agent with a natural language question */
  investigate: (req: string, threadId: string) => {
    console.log("[investigate] req:", req, "thread:", threadId);
    return api
      .post<ReportMetadata>("/investigate", { query: req, thread_id: threadId })
      .then((r) => r.data);
  },

  /** Cancel a running investigation by thread ID */
  cancelInvestigation: (threadId: string) =>
    api.delete(`/investigate/${threadId}`).catch(() => {}), // best-effort

  /** Get a report by its filename stem */
  getReport: (report_id: string) => {
    console.log("[getReport] report_id:", report_id);
    return api.get<ReportMetadata>(`/reports/${report_id}`).then((r) => r.data);
  },

  // ── Case Files ────────────────────────────────────────────────────────────

  fetchCaseFiles: (): Promise<{ caseFiles: unknown[] }> =>
    api.get<{ cases: unknown[] }>("/cases/").then((r) => ({ caseFiles: r.data.cases })),

  createCaseFile: (payload: {
    caseNumber: string;
    subject: string;
    folderId?: string | null;
    category?: string | null;
    projectId?: string | null;
    messages: unknown[];
  }): Promise<unknown> =>
    api.post("/cases/", {
      subject: payload.subject,
      messages: payload.messages,
      folder_id: payload.folderId ?? null,
      category: payload.category ?? null,
      project_id: payload.projectId ?? null,
    }).then((r) => r.data),

  updateCaseFile: (
    id: string,
    payload: {
      caseNumber?: string;
      subject?: string;
      folderId?: string;
      category?: string;
      projectId?: string;
      messages?: unknown[];
    },
  ): Promise<unknown> =>
    api.patch(`/cases/${id}`, {
      subject: payload.subject,
      case_number: payload.caseNumber,
      folder_id: payload.folderId,
      category: payload.category,
      project_id: payload.projectId,
      messages: payload.messages,
    }).then((r) => r.data),

  deleteCaseFile: (id: string): Promise<void> =>
    api.delete(`/cases/${id}`).then(() => {}),

  // ── Folders ───────────────────────────────────────────────────────────────

  fetchFolders: (): Promise<{ folders: unknown[] }> =>
    api.get<{ folders: unknown[] }>("/folders").then((r) => r.data),

  createFolder: (name: string, color?: string): Promise<unknown> =>
    api.post("/folders", { name, color: color ?? null }).then((r) => r.data),

  updateFolder: (
    id: string,
    payload: { name?: string; color?: string },
  ): Promise<unknown> =>
    api.patch(`/folders/${id}`, { name: payload.name, color: payload.color }).then((r) => r.data),

  deleteFolder: (id: string): Promise<void> =>
    api.delete(`/folders/${id}`).then(() => {}),

  // ── Projects ──────────────────────────────────────────────────────────────

  fetchProjects: (): Promise<{ projects: unknown[] }> =>
    api.get<{ projects: unknown[] }>("/projects").then((r) => r.data),

  createProject: (name: string, description?: string): Promise<unknown> =>
    api.post("/projects", { name, description: description ?? null }).then((r) => r.data),

  updateProject: (
    id: string,
    payload: { name?: string; description?: string },
  ): Promise<unknown> =>
    api.patch(`/projects/${id}`, { name: payload.name, description: payload.description }).then((r) => r.data),

  deleteProject: (id: string): Promise<void> =>
    api.delete(`/projects/${id}`).then(() => {}),

  // ── Project Documents ─────────────────────────────────────────────────────

  uploadProjectDocument: (
    projectId: string,
    file: File,
  ): Promise<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: number;
    url: string;
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    return api
      .post<{ id: string; name: string; size: number; type: string; uploadedAt: number; url: string }>(
        `/projects/${projectId}/documents/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      )
      .then((r) => r.data);
  },

  removeProjectDocument: (
    projectId: string,
    documentId: string,
  ): Promise<void> =>
    api.delete(`/projects/${projectId}/documents/${documentId}`).then(() => {}),
};

/** WebSocket connection for live graph updates */
