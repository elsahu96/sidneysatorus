import { api } from "./client";

export const projectApi = {
  fetchProjects: () =>
    api.get<{ projects: unknown[] }>("/projects").then((r) => ({ projects: r.data.projects })),

  createProject: (name: string, description?: string) =>
    api.post("/projects", { name, description: description ?? null }).then((r) => r.data),

  updateProject: (id: string, payload: { name?: string; description?: string }) =>
    api.patch(`/projects/${id}`, payload).then((r) => r.data),

  deleteProject: (id: string) => api.delete(`/projects/${id}`).then(() => {}),

  uploadProjectDocument: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{
        id: string;
        name: string;
        size: number;
        type: string;
        uploadedAt: number;
        url: string;
      }>(`/projects/${projectId}/documents`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  removeProjectDocument: (projectId: string, documentId: string) =>
    api.delete(`/projects/${projectId}/documents/${documentId}`).then(() => {}),
};
