import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, Search } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useCaseFiles } from "@/contexts/CaseFilesContext";
import { cn } from "@/lib/utils";

const Admin = () => {
  const { isCollapsed } = useSidebarContext();
  const { caseFiles } = useCaseFiles();

  const stats = [
    { title: "Total Users", value: "1", icon: Users },
    { title: "Case Files", value: caseFiles.length.toString(), icon: FileText },
    { title: "Active Investigations", value: caseFiles.length.toString(), icon: Search },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <main className={cn(
        "flex-1 transition-all duration-300 overflow-y-auto",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        <div className="p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div>
              <h1 className="text-4xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-muted-foreground mt-2">System overview and settings</p>
            </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-2">
                  <stat.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button className="w-full justify-start h-auto py-4" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users
                  </Button>
                  <Button className="w-full justify-start h-auto py-4" variant="outline">
                    <FileText className="h-4 w-4 mr-2" />
                    View All Cases
                  </Button>
                  <Button className="w-full justify-start h-auto py-4" variant="outline">
                    <Search className="h-4 w-4 mr-2" />
                    System Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Admin;
