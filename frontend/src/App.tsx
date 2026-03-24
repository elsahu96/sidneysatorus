import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import { CaseFilesProvider } from "./contexts/CaseFilesContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import CaseFiles from "@/pages/CaseFiles";
import CaseDetail from "@/pages/CaseDetail";
import Admin from "@/pages/Admin";
import DarkWeb from "@/pages/DarkWeb";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
        <CaseFilesProvider>
          <SidebarProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                      <AuthGuard>
                        <Index />
                      </AuthGuard>
                  }
                />
                <Route
                  path="/case-files"
                  element={
                    <AuthGuard>
                      <CaseFiles />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/case/:id"
                  element={
                    <AuthGuard>
                      <CaseDetail />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AuthGuard>
                      <Admin />
                    </AuthGuard>
                  }
                />
                <Route
                  path="/dark-web"
                  element={
                    <AuthGuard>
                      <DarkWeb />
                    </AuthGuard>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SidebarProvider>
        </CaseFilesProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
