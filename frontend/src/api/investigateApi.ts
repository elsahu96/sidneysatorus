import { ReportMetadata } from "@/types";
import { api } from "./client";

export const investigateApi = {
  start: (query: string, opts?: { signal?: AbortSignal }) => {
    console.log("[investigate] req:", query);
    return api
      .post("/investigate", { query }, { signal: opts?.signal })
      .then((r) => ({
        id: r.data.id || r.data.task_id,
        status: r.data.status,
      }));
  },

  terminate: (taskId: string) =>
    api.post(`/terminate/${taskId}`).then((r) => r.data),

  getReport: (reportId: string) =>
    api.get<ReportMetadata>(`/reports/${reportId}`).then((r) => r.data),

  getStatus: (taskId: string) =>
    api.get(`/status/${taskId}`).then((r) => r.data),

  connectStatus: (taskId: string, onMessage: (data: any) => void) => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    // 动态获取当前 Host (例如 localhost:4567)
    const host = window.location.host;

    // 构造 URL。注意：如果你用 Vite 代理，路径前缀要和 vite.config.ts 对应
    const wsUrl = `${protocol}//${host}/ws/${taskId}`;
    console.log("Connecting to WS:", wsUrl);

    const socket = new WebSocket(wsUrl);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    return socket;
  },
};
