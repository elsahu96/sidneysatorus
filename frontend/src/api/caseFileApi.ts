import { api } from "./client";

export const caseFileApi = {
  fetchCaseFiles: () =>
    api.get<{ cases: unknown[] }>("/cases/").then((r) => ({ caseFiles: r.data.cases })),

  createCaseFile: (payload: {
    caseNumber: string;
    subject: string;
    folderId?: string | null;
    category?: string | null;
    projectId?: string | null;
    messages: unknown[];
  }) =>
    api
      .post("/cases/", {
        subject: payload.subject,
        case_number: payload.caseNumber,
        folder_id: payload.folderId ?? null,
        category: payload.category ?? null,
        project_id: payload.projectId ?? null,
        messages: payload.messages,
      })
      .then((r) => r.data),

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
  ) =>
    api
      .patch(`/cases/${id}`, {
        subject: payload.subject,
        case_number: payload.caseNumber,
        folder_id: payload.folderId,
        category: payload.category,
        project_id: payload.projectId,
        messages: payload.messages,
      })
      .then((r) => r.data),

  deleteCaseFile: (id: string) => api.delete(`/cases/${id}`).then(() => {}),
};
