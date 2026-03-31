import { api } from "./client";

export const folderApi = {
  fetchFolders: () =>
    api.get<{ folders: unknown[] }>("/folders").then((r) => ({ folders: r.data.folders })),

  createFolder: (name: string, color?: string) =>
    api.post("/folders", { name, color: color ?? null }).then((r) => r.data),

  updateFolder: (id: string, payload: { name?: string; color?: string }) =>
    api.patch(`/folders/${id}`, payload).then((r) => r.data),

  deleteFolder: (id: string) => api.delete(`/folders/${id}`).then(() => {}),
};
