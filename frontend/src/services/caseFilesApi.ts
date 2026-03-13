/**
 * Case Files, Folders, Projects API.
 * All requests use the auth-backed api client (Bearer token).
 */

import { apiClient } from "@/lib/api";
import type {
  CaseFile,
  Folder,
  Project,
  ProjectDocument,
} from "@/contexts/CaseFilesContext";

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
  category: (raw.category as CaseFile["category"]) ?? undefined,
  projectId: raw.projectId ?? undefined,
  messages: (raw.messages || []) as CaseFile["messages"],
});

const toFolder = (raw: {
  id: string;
  name: string;
  timestamp: number;
  color?: string | null;
}): Folder => ({
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
  documents: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: number;
    url: string;
  }>;
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

export async function fetchCaseFiles(
  _accessToken?: string,
): Promise<CaseFile[]> {
  const data = await apiClient.fetchCaseFiles();
  return (data.caseFiles || []).map((raw) =>
    toCaseFile(raw as Parameters<typeof toCaseFile>[0]),
  );
}

export async function fetchFolders(_accessToken?: string): Promise<Folder[]> {
  const data = await apiClient.fetchFolders();
  return (data.folders || []).map((raw) =>
    toFolder(raw as Parameters<typeof toFolder>[0]),
  );
}

export async function fetchProjects(
  _accessToken?: string,
): Promise<Project[]> {
  const data = await apiClient.fetchProjects();
  return (data.projects || []).map((raw) =>
    toProject(raw as Parameters<typeof toProject>[0]),
  );
}

export async function createCaseFile(payload: {
  caseNumber: string;
  subject: string;
  folderId?: string;
  category?: string;
  projectId?: string;
  messages: CaseFile["messages"];
}): Promise<CaseFile> {
  const data = await apiClient.createCaseFile({
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
  },
): Promise<CaseFile> {
  const data = await apiClient.updateCaseFile(id, payload);
  return toCaseFile(data as Parameters<typeof toCaseFile>[0]);
}

export async function deleteCaseFile(id: string): Promise<void> {
  await apiClient.deleteCaseFile(id);
}

export async function createFolder(
  name: string,
  color?: string,
): Promise<Folder> {
  const data = await apiClient.createFolder(name, color);
  return toFolder(data as Parameters<typeof toFolder>[0]);
}

export async function updateFolder(
  id: string,
  payload: { name?: string; color?: string },
): Promise<Folder> {
  const data = await apiClient.updateFolder(id, payload);
  return toFolder(data as Parameters<typeof toFolder>[0]);
}

export async function deleteFolder(id: string): Promise<void> {
  await apiClient.deleteFolder(id);
}

export async function createProject(
  name: string,
  description?: string,
): Promise<Project> {
  const data = await apiClient.createProject(name, description);
  return toProject(data as Parameters<typeof toProject>[0]);
}

export async function updateProject(
  id: string,
  payload: { name?: string; description?: string },
): Promise<Project> {
  const data = await apiClient.updateProject(id, payload);
  return toProject(data as Parameters<typeof toProject>[0]);
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.deleteProject(id);
}

export async function uploadProjectDocument(
  projectId: string,
  file: File,
): Promise<ProjectDocument> {
  return apiClient.uploadProjectDocument(projectId, file);
}

export async function removeProjectDocument(
  projectId: string,
  documentId: string,
): Promise<void> {
  await apiClient.removeProjectDocument(projectId, documentId);
}
