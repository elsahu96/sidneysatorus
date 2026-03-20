import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {



  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        throw new Error(
          "Cannot reach auth service. Check your connection and that VITE_SUPABASE_URL and Supabase key are set in .env."
        );
      }
      throw err;
    }
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, name?: string) => {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: name ? { data: { name } } : undefined,
        });
        if (error) throw error;
      } catch (err) {
        if (err instanceof TypeError && err.message === "Failed to fetch") {
          throw new Error(
            "Error: Cannot reach auth service. "
          );
        }
        throw err;
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
