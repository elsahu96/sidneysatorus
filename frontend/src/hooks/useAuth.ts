import { useEffect, useState } from "react";
import { onAuthStateChanged, reload, User } from "firebase/auth";
import { auth } from "@/firebase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ✅ 加这个：强制从 Firebase 重新拉取最新 user 信息
  const refreshUser = async () => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      setUser({ ...auth.currentUser }); // 触发 re-render
    }
  };

  return { user, loading, refreshUser };
}
