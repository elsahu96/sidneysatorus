import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

function getTenantId(email) {
  if (email.endsWith("@satorus.com")) return "Satorus-kpar0";
  // if (email.endsWith("@company-b.com")) return "tenant-b-id-xxxx";
  return null; // default tenant
}

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuth();

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const messageFromError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (/too-many-requests|quota-exceeded/i.test(msg)) {
      return "Too many attempts. Please try again later.";
    }
    if (/user-not-found|wrong-password|invalid-credential|invalid login credentials/i.test(msg)) {
      return "Invalid email or password.";
    }
    if (/email-already-in-use/i.test(msg)) {
      return "An account with this email already exists.";
    }
    if (/failed to fetch|cannot reach auth|network/i.test(msg) || err instanceof TypeError) {
      return "Cannot reach auth service. Check your connection and that Supabase is configured (VITE_SUPABASE_URL and key in .env).";
    }
    return msg;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tenantId = getTenantId(email);
      auth.tenantId = tenantId; // 关键：切换到对应 tenant

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      // 把 token 存起来，后续 API 请求用
      localStorage.setItem("idToken", idToken);

      await callBackend(idToken);
      // useEffect will redirect when user is set
    } catch (err: unknown) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await userCred.user.getIdToken();
      await callBackend(idToken); // send to the backend
      // useEffect will redirect when user is set
    } catch (err: unknown) {
      setError(messageFromError(err));
    } finally {
      setLoading(false);
    }
  };

  // 发送 ID Token 到后端
  const callBackend = async (idToken) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/protected`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await res.json();
    console.log("后端返回：", data);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (user) return null; // redirect in progress

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sidney</CardTitle>
          <CardDescription>Sign in or create an account to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name (optional)</Label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-up">Email</Label>
                  <Input
                    id="email-up"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-up">Password</Label>
                  <Input
                    id="password-up"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account…" : "Sign up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;