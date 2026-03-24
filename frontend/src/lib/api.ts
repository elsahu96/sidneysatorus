import axios from "axios";
import type { ReportMetadata } from "@/types/index";
import { auth } from "@/firebase";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

// Create axios instance
const api = axios.create({
  baseURL: "/",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookies/sessions
});

export const apiClient = {
  
  // getUser: (id: string) => {
  //   return api.get<{ user: User }>(`/user/profile/${id}`);
  // },
  // updateUser: (id: string, data: Partial<User>) => {
  //   return api.put<{ user: User }>(`/user/profile/${id}`, data);
  // },
  /** Query the agent with a natural language question */
  investigate: (req: string) => {
    console.log("[investigate] req:", req);
    return api
      .post<ReportMetadata>("/investigate", { query: req })
      .then((r) => r.data);
  },

  /** Get a report by its filename stem */
  getReport: (report_id: string) => {
    console.log("[getReport] report_id:", report_id);
    return api.get<ReportMetadata>(`/reports/${report_id}`).then((r) => r.data);
  },

  // ── Case Files ────────────────────────────────────────────────────────────

  fetchCaseFiles: (): Promise<{ caseFiles: unknown[] }> =>
    Promise.resolve({ caseFiles: [] }),

  createCaseFile: (payload: {
    caseNumber: string;
    subject: string;
    folderId?: string | null;
    category?: string | null;
    projectId?: string | null;
    messages: unknown[];
  }): Promise<unknown> =>
    Promise.resolve({
      id: crypto.randomUUID(),
      caseNumber: payload.caseNumber,
      subject: payload.subject,
      timestamp: Date.now(),
      folderId: payload.folderId ?? null,
      category: payload.category ?? null,
      projectId: payload.projectId ?? null,
      messages: payload.messages,
    }),

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
    Promise.resolve({
      id,
      caseNumber: payload.caseNumber ?? "",
      subject: payload.subject ?? "",
      timestamp: Date.now(),
      folderId: payload.folderId ?? null,
      category: payload.category ?? null,
      projectId: payload.projectId ?? null,
      messages: payload.messages ?? [],
    }),

  deleteCaseFile: (_id: string): Promise<void> => Promise.resolve(),

  // ── Folders ───────────────────────────────────────────────────────────────

  fetchFolders: (): Promise<{ folders: unknown[] }> =>
    Promise.resolve({ folders: [] }),

  createFolder: (name: string, color?: string): Promise<unknown> =>
    Promise.resolve({
      id: crypto.randomUUID(),
      name,
      timestamp: Date.now(),
      color: color ?? null,
    }),

  updateFolder: (
    id: string,
    payload: { name?: string; color?: string },
  ): Promise<unknown> =>
    Promise.resolve({
      id,
      name: payload.name ?? "",
      timestamp: Date.now(),
      color: payload.color ?? null,
    }),

  deleteFolder: (_id: string): Promise<void> => Promise.resolve(),

  // ── Projects ──────────────────────────────────────────────────────────────

  fetchProjects: (): Promise<{ projects: unknown[] }> =>
    Promise.resolve({ projects: [] }),

  createProject: (name: string, description?: string): Promise<unknown> =>
    Promise.resolve({
      id: crypto.randomUUID(),
      name,
      description: description ?? null,
      timestamp: Date.now(),
      documents: [],
      reports: [],
      chatHistory: [],
    }),

  updateProject: (
    id: string,
    payload: { name?: string; description?: string },
  ): Promise<unknown> =>
    Promise.resolve({
      id,
      name: payload.name ?? "",
      description: payload.description ?? null,
      timestamp: Date.now(),
      documents: [],
      reports: [],
      chatHistory: [],
    }),

  deleteProject: (_id: string): Promise<void> => Promise.resolve(),

  // ── Project Documents ─────────────────────────────────────────────────────

  uploadProjectDocument: (
    _projectId: string,
    file: File,
  ): Promise<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: number;
    url: string;
  }> =>
    Promise.resolve({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: Date.now(),
      url: "",
    }),

  removeProjectDocument: (
    _projectId: string,
    _documentId: string,
  ): Promise<void> => Promise.resolve(),
};

/** WebSocket connection for live graph updates */
