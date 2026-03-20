// 每次请求前获取最新 token（firebase 会自动刷新）
import { auth } from "./firebase";

/////////////////////////////// 示例 ///////////////////////////////
// 在任何页面/组件里
// const res = await apiFetch("/api/profile");
// const data = await res.json();
export async function apiFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("未登录");

  const idToken = await user.getIdToken(); // 自动刷新过期 token

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
  });
}
