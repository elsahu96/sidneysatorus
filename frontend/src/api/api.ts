import { investigateApi } from "./investigateApi";
import { caseFileApi } from "./caseFileApi";
import { folderApi } from "./folderApi";
import { projectApi } from "./projectApi";
import { reportApi } from "./reportApi";
import { userApi } from "./userApi";
import { sessionApi } from "./sessionApi";

export const apiClient = {
  investigate: investigateApi,
  report: reportApi,
  caseFile: caseFileApi,
  folder: folderApi,
  project: projectApi,
  user: userApi,
  session: sessionApi,
};
