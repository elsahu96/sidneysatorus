import axios from "axios";
import type { ReportMetadata } from "@/types/index";
import { auth } from "@/firebase";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookies/sessions
});
export const userService = {
  registerUser: async (email: string, password: string, tenantId: string) => {
    return api.post(`${API_BASE_URL}/user/register`, {
      email,
      password,
      tenantId,
    });
  },

  // 发送 ID Token 到后端
  sendIdToken: async () => {
    const user = auth.currentUser;
    if (!user) throw new Error("Not logged in");

    const idToken = await user.getIdToken(); // 自动刷新过期 token
    const res = await fetch(`${API_BASE_URL}/auth/protected`, {
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail ?? `Auth failed: ${res.status}`);
    }
    return res;
  },

  signout: () => {
    return api.post("/auth/signout");
  },
};
