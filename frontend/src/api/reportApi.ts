import { api } from "./client";
import type { ReportMetadata } from "@/types/index";

export const reportApi = {
  getReport: (report_id: string) => {
    console.log("[getReport] report_id:", report_id);
    return api.get<ReportMetadata>(`/reports/${report_id}`).then((r) => r.data);
  },
};
