import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    // By default, authDomain is '[YOUR_APP].firebaseapp.com'.
    // You may replace it with a custom domain.
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN
  };
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

const tenantId = "Satorus-kpar0";
auth.tenantId = tenantId;
