import { api } from "./client";
import { auth } from "@/firebase";

export const userApi = {
  registerUser: async (email: string, password: string, tenantId: string) => {
    return api.post("/user/register", {
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
    const res = await api.post("/auth/protected", {
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
