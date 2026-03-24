import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { userService } from "@/services/userService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/firebase";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { getTenantId } from "@/services/tenantService";
import { apiClient } from "@/lib/api";
import axios from "axios";



const Login = () => {
  const { user, loading, refreshUser } = useAuth();
  const [skipRedirect, setSkipRedirect] = useState(false); 
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !skipRedirect) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate, skipRedirect]);

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
    if (/failed to fetch|network request failed|net::err/i.test(msg)) {
      return "Cannot reach auth service. Check your connection.";
    }
    return msg;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSkipRedirect(true); // ✅ 先阻止自动跳转


    try {
      console.log("Calling backend with email:", email);
      const tenantId = getTenantId(email);
      console.log("Tenant ID:", tenantId);
      if (!tenantId) {
        setError("This email domain is not associated with any organisation.");
        return;
      }
      const freshAuth = getAuth();
      freshAuth.tenantId = tenantId;
      const userCredential = await signInWithEmailAndPassword(freshAuth, email, password);
      console.log("User:", userCredential.user);
      await userService.sendIdToken();
      navigate("/", { replace: true });
      // useEffect will redirect when user is set
    } catch (err: unknown) {
      setError(messageFromError(err));
    } finally {
      setSubmitting(false);
      setSkipRedirect(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    setSkipRedirect(true); 
    try {
      console.log("auth.tenantId:", auth.tenantId);
      console.log("auth.app.options:", auth.app.options);
      const tenantId = getTenantId(email);
      if (!tenantId) {
        // TODO: create a new tenant 
        setError("This email domain is not associated with any organisation.");
        return;
      }
      console.log("Registering user with email:", email);
      console.log("Tenant ID:", tenantId);
      const resp = await userService.registerUser(email, password, tenantId);
      if (resp.status !== 200) {
        setError(resp.data?.detail ?? "Registration failed.");
        return;
      }
      console.log("Setting tenant ID:", tenantId);
      auth.tenantId = tenantId;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("User credential:", userCredential);
      if (name.trim()) {
        await updateProfile(userCredential.user, { displayName: name.trim() });
        await refreshUser();
      }
  
      console.log("Calling backend with ID Token:");
      
      await userService.sendIdToken(); // send to the backend
      navigate("/", { replace: true });
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail ?? err.message);
      } else {
        setError(messageFromError(err));
      }
    } finally {
      setSubmitting(false);
      setSkipRedirect(false); 
    }
  };


  if (submitting) {
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