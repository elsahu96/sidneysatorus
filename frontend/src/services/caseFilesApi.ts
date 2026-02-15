/**
 * Case Files, Folders, Projects API.
 * All requests use the auth-backed api client (Bearer token).
 */

import api from "@/lib/api";
import type { CaseFile, Folder, Project, ProjectDocument } from "@/contexts/CaseFilesContext";

const toCaseFile = (raw: {
  id: string;
  caseNumber: string;
  subject: string;
  timestamp: number;
  folderId?: string | null;
  category?: string | null;
  projectId?: string | null;
  messages: Array<Record<string, unknown>>;
}): CaseFile => ({
  id: raw.id,
  caseNumber: raw.caseNumber,
  subject: raw.subject,
  timestamp: raw.timestamp,
  folderId: raw.folderId ?? undefined,
  category: raw.category as CaseFile["category"] ?? undefined,
  projectId: raw.projectId ?? undefined,
  messages: (raw.messages || []) as CaseFile["messages"],
});

const toFolder = (raw: { id: string; name: string; timestamp: number; color?: string | null }): Folder => ({
  id: raw.id,
  name: raw.name,
  timestamp: raw.timestamp,
  color: raw.color ?? undefined,
});

const toProject = (raw: {
  id: string;
  name: string;
  description?: string | null;
  timestamp: number;
  documents: Array<{ id: string; name: string; size: number; type: string; uploadedAt: number; url: string }>;
  reports?: CaseFile[];
  chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}): Project => ({
  id: raw.id,
  name: raw.name,
  description: raw.description ?? undefined,
  timestamp: raw.timestamp,
  documents: (raw.documents || []).map((d) => ({
    id: d.id,
    name: d.name,
    size: d.size,
    type: d.type,
    uploadedAt: d.uploadedAt,
    url: d.url,
  })),
  reports: raw.reports || [],
  chatHistory: raw.chatHistory || [],
});

function authHeaders(accessToken: string | undefined) {
  if (!accessToken) return undefined;
  return { Authorization: `Bearer ${accessToken}` };
}

export async function fetchCaseFiles(accessToken?: string): Promise<CaseFile[]> {
  const { data } = await api.get<{ caseFiles: unknown[] }>("/api/case-files", {
    headers: authHeaders(accessToken),
  });
  return (data.caseFiles || []).map((raw) => toCaseFile(raw as Parameters<typeof toCaseFile>[0]));
}

export async function fetchFolders(accessToken?: string): Promise<Folder[]> {
  const { data } = await api.get<{ folders: unknown[] }>("/api/folders", {
    headers: authHeaders(accessToken),
  });
  return (data.folders || []).map((raw) => toFolder(raw as Parameters<typeof toFolder>[0]));
}

export async function fetchProjects(accessToken?: string): Promise<Project[]> {
  const { data } = await api.get<{ projects: unknown[] }>("/api/projects", {
    headers: authHeaders(accessToken),
  });
  return (data.projects || []).map((raw) => toProject(raw as Parameters<typeof toProject>[0]));
}

export async function createCaseFile(payload: {
  caseNumber: string;
  subject: string;
  folderId?: string;
  category?: string;
  projectId?: string;
  messages: CaseFile["messages"];
}): Promise<CaseFile> {
  const { data } = await api.post<unknown>("/api/case-files", {
    caseNumber: payload.caseNumber,
    subject: payload.subject,
    folderId: payload.folderId ?? null,
    category: payload.category ?? null,
    projectId: payload.projectId ?? null,
    messages: payload.messages,
  });
  return toCaseFile(data as Parameters<typeof toCaseFile>[0]);
}

export async function updateCaseFile(
  id: string,
  payload: {
    caseNumber?: string;
    subject?: string;
    folderId?: string;
    category?: string;
    projectId?: string;
    messages?: CaseFile["messages"];
  }
): Promise<CaseFile> {
  const { data } = await api.patch<unknown>(`/api/case-files/${id}`, {
    caseNumber: payload.caseNumber ?? undefined,
    subject: payload.subject ?? undefined,
    folderId: payload.folderId ?? undefined,
    category: payload.category ?? undefined,
    projectId: payload.projectId ?? undefined,
    messages: payload.messages ?? undefined,
  });
  return toCaseFile(data as Parameters<typeof toCaseFile>[0]);
}

export async function deleteCaseFile(id: string): Promise<void> {
  await api.delete(`/api/case-files/${id}`);
}

export async function createFolder(name: string, color?: string): Promise<Folder> {
  const { data } = await api.post<unknown>("/api/folders", { name, color: color ?? null });
  return toFolder(data as Parameters<typeof toFolder>[0]);
}

export async function updateFolder(id: string, payload: { name?: string; color?: string }): Promise<Folder> {
  const { data } = await api.patch<unknown>(`/api/folders/${id}`, payload);
  return toFolder(data as Parameters<typeof toFolder>[0]);
}

export async function deleteFolder(id: string): Promise<void> {
  await api.delete(`/api/folders/${id}`);
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const { data } = await api.post<unknown>("/api/projects", { name, description: description ?? null });
  return toProject(data as Parameters<typeof toProject>[0]);
}

export async function updateProject(id: string, payload: { name?: string; description?: string }): Promise<Project> {
  const { data } = await api.patch<unknown>(`/api/projects/${id}`, payload);
  return toProject(data as Parameters<typeof toProject>[0]);
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}

export async function uploadProjectDocument(projectId: string, file: File): Promise<ProjectDocument> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: number;
    url: string;
  }>(`/api/projects/${projectId}/documents`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return {
    id: data.id,
    name: data.name,
    size: data.size,
    type: data.type,
    uploadedAt: data.uploadedAt,
    url: data.url,
  };
}

export async function removeProjectDocument(projectId: string, documentId: string): Promise<void> {
  await api.delete(`/api/projects/${projectId}/documents/${documentId}`);
}
