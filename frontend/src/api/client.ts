import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8080",
  withCredentials: true,
});

// Handle Token or error interceptors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 or 500 errors
    return Promise.reject(error);
  },
);
