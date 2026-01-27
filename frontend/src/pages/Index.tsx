import { Sidebar } from "@/components/Sidebar";
import { ChatInterface } from "@/components/ChatInterface";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";

const Index = () => {
  const { isCollapsed } = useSidebarContext();

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar />
      <main className={cn(
        "flex-1 h-screen overflow-hidden transition-all duration-300",
        isCollapsed ? "ml-16" : "ml-64"
      )}>

        <ChatInterface />
      </main>
    </div>
  );
};

export default Index;
