export const caseFileApi = {
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
};
