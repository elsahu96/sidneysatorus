export const folderApi = {
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
};
