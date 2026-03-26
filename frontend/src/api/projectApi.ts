export const projectApi = {
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
