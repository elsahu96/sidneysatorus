import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase";

export function useSignOut() {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(auth);
    // onAuthStateChanged will set user to null
    // ProtectedRoute will automatically redirect to /login
    navigate("/login", { replace: true });
  };

  return { handleSignOut };
}
