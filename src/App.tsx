import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CaseFilesProvider } from "./contexts/CaseFilesContext";
import { SidebarProvider } from "./contexts/SidebarContext";
import Index from "./pages/Index";
import CaseFiles from "./pages/CaseFiles";
import CaseDetail from "./pages/CaseDetail";
import Admin from "./pages/Admin";
import DarkWeb from "./pages/DarkWeb";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SidebarProvider>
        <CaseFilesProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/case-files" element={<CaseFiles />} />
              <Route path="/case/:id" element={<CaseDetail />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/dark-web" element={<DarkWeb />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CaseFilesProvider>
      </SidebarProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
