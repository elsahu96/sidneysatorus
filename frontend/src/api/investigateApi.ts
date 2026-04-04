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
    api.get<ReportMetadata>(`/reports/${reportId}`).then((r) => {
      console.log("InvestigateApi: getReport: r:", r);
      return r.data;
    }),

  getStatus: (taskId: string) =>
    api.get(`/status/${taskId}`).then((r) => r.data),

  connectStatus: (taskId: string, onMessage: (data: any) => void) => {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const protocol = apiUrl.startsWith("https") ? "wss:" : "ws:";
    const host = apiUrl.replace(/^https?:\/\//, "");
    const wsUrl = `${protocol}//${host}/ws/${taskId}`;
    console.log("Connecting to WS:", wsUrl);

    const socket = new WebSocket(wsUrl);
    socket.onopen = () => {
      console.log("[WebSocket] Connection established for task:", taskId);
    };

    socket.onmessage = (event) => {
      console.log("[WebSocket] Raw data received:", event.data); 
      const data = JSON.parse(event.data);
      onMessage(data);
    };
    socket.onerror = (err) => {
      console.error("[WebSocket] Error details:", err);
    };

    return socket;
  },
};
