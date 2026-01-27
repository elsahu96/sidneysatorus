import { useState, useMemo, useEffect, useRef } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useCaseFiles, type CaseFile } from "@/contexts/CaseFilesContext";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { FolderOpen, Calendar, MoreVertical, Trash2, Edit2, Search, Folder, FolderPlus, MoveRight, ArrowUpDown, Download, FileJson, FileText, Upload, File, MessageSquare, Send, Loader2, Users, CheckSquare, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Project } from "@/contexts/CaseFilesContext";
import { exportReportToPDF } from "@/lib/pdfExport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TaiwanReport } from "@/components/TaiwanReport";
import { LoadingStages } from "@/components/LoadingStages";

const CaseFiles = () => {
  const { 
    caseFiles, 
    folders, 
    projects,
    addCaseFile,
    deleteCaseFile, 
    renameCaseFile, 
    moveCaseToFolder, 
    createFolder, 
    deleteFolder, 
    renameFolder,
    createProject,
    deleteProject,
    updateProject,
    addDocumentToProject,
    removeDocumentFromProject,
    addReportToProject,
    addChatMessageToProject
  } = useCaseFiles();
  const { isCollapsed } = useSidebarContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [newCaseName, setNewCaseName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | "all" | "uncategorized">("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "name">("date-desc");
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [deleteFolderDialogOpen, setDeleteFolderDialogOpen] = useState(false);
  const [renameFolderDialogOpen, setRenameFolderDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  
  // Projects state
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [loadingStages, setLoadingStages] = useState<string[]>([]);
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projectActiveTab, setProjectActiveTab] = useState<"chat" | "reports" | "documents">("chat");
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Bulk selection state
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [selectedReportIds, setSelectedReportIds] = useState<Set<string>>(new Set());
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());

  // Handle navigation from report back to project
  useEffect(() => {
    const state = location.state as { openProjectId?: string; activeTab?: "chat" | "reports" | "documents" } | null;
    if (state?.openProjectId) {
      const project = projects.find(p => p.id === state.openProjectId);
      if (project) {
        setSelectedProject(project);
        setProjectActiveTab(state.activeTab || "reports");
      }
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, projects, navigate, location.pathname]);

  // Keep selectedProject in sync with projects array
  useEffect(() => {
    if (selectedProject) {
      const updatedProject = projects.find(p => p.id === selectedProject.id);
      if (updatedProject && JSON.stringify(updatedProject) !== JSON.stringify(selectedProject)) {
        setSelectedProject(updatedProject);
      }
    }
  }, [projects, selectedProject]);

  // Auto-expand chat textarea based on content
  useEffect(() => {
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = "auto";
      chatTextareaRef.current.style.height = chatTextareaRef.current.scrollHeight + "px";
    }
  }, [chatInput]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCaseId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedCaseId) {
      deleteCaseFile(selectedCaseId);
      toast.success("Case file deleted");
      setDeleteDialogOpen(false);
      setSelectedCaseId(null);
    }
  };

  const handleRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCaseId(id);
    setNewCaseName(currentName);
    setRenameDialogOpen(true);
  };

  const confirmRename = () => {
    if (selectedCaseId && newCaseName.trim()) {
      renameCaseFile(selectedCaseId, newCaseName.trim());
      toast.success("Case file renamed");
      setRenameDialogOpen(false);
      setSelectedCaseId(null);
      setNewCaseName("");
    }
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      createFolder(newFolderName.trim());
      toast.success("Folder created");
      setCreateFolderDialogOpen(false);
      setNewFolderName("");
    }
  };

  const handleDeleteFolder = (id: string) => {
    setSelectedFolderId(id);
    setDeleteFolderDialogOpen(true);
  };

  const confirmDeleteFolder = () => {
    if (selectedFolderId) {
      deleteFolder(selectedFolderId);
      toast.success("Folder deleted - case files moved to uncategorized");
      setDeleteFolderDialogOpen(false);
      setSelectedFolderId(null);
      if (selectedFolder === selectedFolderId) {
        setSelectedFolder("all");
      }
    }
  };

  const handleRenameFolder = (id: string, currentName: string) => {
    setSelectedFolderId(id);
    setNewFolderName(currentName);
    setRenameFolderDialogOpen(true);
  };

  const confirmRenameFolder = () => {
    if (selectedFolderId && newFolderName.trim()) {
      renameFolder(selectedFolderId, newFolderName.trim());
      toast.success("Folder renamed");
      setRenameFolderDialogOpen(false);
      setSelectedFolderId(null);
      setNewFolderName("");
    }
  };

  const handleMoveToFolder = (caseId: string, folderId: string | undefined) => {
    moveCaseToFolder(caseId, folderId);
    toast.success(folderId ? "Moved to folder" : "Moved to uncategorized");
  };

  // Filter and sort case files (exclude project reports)
  const filteredAndSortedCaseFiles = useMemo(() => {
    let filtered = caseFiles.filter(file => !file.projectId); // Exclude project reports

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (file) =>
          file.caseNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.subject.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by folder
    if (selectedFolder === "uncategorized") {
      filtered = filtered.filter((file) => !file.folderId);
    } else if (selectedFolder !== "all") {
      filtered = filtered.filter((file) => file.folderId === selectedFolder);
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case "date-desc":
        sorted.sort((a, b) => b.timestamp - a.timestamp);
        break;
      case "date-asc":
        sorted.sort((a, b) => a.timestamp - b.timestamp);
        break;
      case "name":
        sorted.sort((a, b) => a.caseNumber.localeCompare(b.caseNumber));
        break;
    }

    return sorted;
  }, [caseFiles, searchQuery, selectedFolder, sortBy]);
  
  // Projects functions
  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      createProject(newProjectName.trim(), newProjectDescription.trim());
      toast.success("Project created");
      setCreateProjectDialogOpen(false);
      setNewProjectName("");
      setNewProjectDescription("");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedProject) return;

    Array.from(files).forEach(file => {
      const document = {
        id: Date.now().toString() + Math.random(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: Date.now(),
        url: URL.createObjectURL(file)
      };
      addDocumentToProject(selectedProject.id, document);
    });
    
    toast.success(`${files.length} document(s) uploaded`);
    e.target.value = "";
  };

  const handleDeleteDocument = (documentId: string) => {
    if (selectedProject) {
      removeDocumentFromProject(selectedProject.id, documentId);
      toast.success("Document removed");
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedProject || isLoadingChat) return;

    const userMessage = { role: "user" as const, content: chatInput };
    addChatMessageToProject(selectedProject.id, userMessage);
    const query = chatInput.toLowerCase().trim();
    setChatInput("");
    setIsLoadingChat(true);

    // Check if user asked for Taiwan news report
    if (query === "give me a news roundup from the last month of everything related to my techforward project.") {
      // Show loading stages for Taiwan report
      const taiwanStages = [
        "Defined scope & timelines",
        "Political baseline",
        "Security posture",
        "Macro filter",
        "Fab geography hedge",
        "Korea capacity check",
        "Shock risks",
        "Synthesis to actions"
      ];
      setLoadingStages(taiwanStages);
      
      // Wait for all stages to complete (8 stages * 750ms = 6000ms)
      await new Promise(resolve => setTimeout(resolve, 6000));
      
      setLoadingStages([]);
      const assistantMessage = {
        role: "assistant" as const,
        content: "TAIWAN_REPORT"
      };
      addChatMessageToProject(selectedProject.id, assistantMessage);
      
      // Save the report to both the project AND the main case files
      const report: CaseFile = {
        id: Date.now().toString(),
        caseNumber: `Taiwan Risk Report - ${new Date().toLocaleDateString()}`,
        subject: "Taiwan Risk & Semiconductor Analysis",
        timestamp: Date.now(),
        category: "Other",
        projectId: selectedProject.id, // Mark this as belonging to the project
        messages: [
          { role: "assistant", content: "TAIWAN_REPORT", isTaiwanReport: true }
        ]
      };
      addReportToProject(selectedProject.id, report);
      addCaseFile(report); // Also add to main case files so it can be viewed
      
      toast.success("Report generated and saved");
    } else {
      // Mock AI response for other queries
      await new Promise(resolve => setTimeout(resolve, 1500));
      const assistantMessage = {
        role: "assistant" as const,
        content: "I've analyzed your project documents. Based on the information provided, I can help you generate reports or answer specific questions about the project."
      };
      addChatMessageToProject(selectedProject.id, assistantMessage);
    }
    setIsLoadingChat(false);
  };
  
  const handleSuggestedPrompt = (prompt: string) => {
    setChatInput(prompt);
  };

  const handleDeleteProject = (id: string) => {
    setProjectToDelete(id);
    setDeleteProjectDialogOpen(true);
  };

  const confirmDeleteProject = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete);
      if (selectedProject?.id === projectToDelete) {
        setSelectedProject(null);
      }
      toast.success("Project deleted");
      setDeleteProjectDialogOpen(false);
      setProjectToDelete(null);
    }
  };

  // Project Report Management
  const handleDeleteReport = (reportId: string) => {
    if (selectedProject) {
      // Remove from project
      const updatedReports = selectedProject.reports.filter(r => r.id !== reportId);
      updateProject(selectedProject.id, { reports: updatedReports });
      // Also remove from main case files
      deleteCaseFile(reportId);
      toast.success("Report deleted");
    }
  };

  const handleRenameReport = (reportId: string, currentName: string) => {
    const newName = prompt("Enter new report name:", currentName);
    if (newName && newName.trim() && selectedProject) {
      // Update in project
      const updatedReports = selectedProject.reports.map(r =>
        r.id === reportId ? { ...r, caseNumber: newName.trim() } : r
      );
      updateProject(selectedProject.id, { reports: updatedReports });
      // Update in main case files
      renameCaseFile(reportId, newName.trim());
      toast.success("Report renamed");
    }
  };

  const handleExportReport = (reportId: string) => {
    const report = selectedProject?.reports.find(r => r.id === reportId);
    if (report) {
      exportReportToPDF(report);
      toast.success("Report exported to PDF");
    }
  };

  const handleNewChat = () => {
    if (selectedProject) {
      updateProject(selectedProject.id, { chatHistory: [] });
      setChatInput("");
      setIsLoadingChat(false);
      setLoadingStages([]);
      toast.success("Chat cleared");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Bulk selection handlers
  const toggleCaseSelection = (id: string) => {
    setSelectedCaseIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllCasesSelection = () => {
    if (selectedCaseIds.size === filteredAndSortedCaseFiles.length) {
      setSelectedCaseIds(new Set());
    } else {
      setSelectedCaseIds(new Set(filteredAndSortedCaseFiles.map(f => f.id)));
    }
  };

  const toggleReportSelection = (id: string) => {
    setSelectedReportIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllReportsSelection = () => {
    if (selectedProject && selectedReportIds.size === selectedProject.reports.length) {
      setSelectedReportIds(new Set());
    } else if (selectedProject) {
      setSelectedReportIds(new Set(selectedProject.reports.map(r => r.id)));
    }
  };

  const toggleDocumentSelection = (id: string) => {
    setSelectedDocumentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAllDocumentsSelection = () => {
    if (selectedProject && selectedDocumentIds.size === selectedProject.documents.length) {
      setSelectedDocumentIds(new Set());
    } else if (selectedProject) {
      setSelectedDocumentIds(new Set(selectedProject.documents.map(d => d.id)));
    }
  };

  // Bulk action handlers
  const handleBulkDeleteCases = () => {
    const count = selectedCaseIds.size;
    selectedCaseIds.forEach(id => deleteCaseFile(id));
    setSelectedCaseIds(new Set());
    toast.success(`${count} case file(s) deleted`);
  };

  const handleBulkDeleteReports = () => {
    if (!selectedProject) return;
    const count = selectedReportIds.size;
    const updatedReports = selectedProject.reports.filter(r => !selectedReportIds.has(r.id));
    updateProject(selectedProject.id, { reports: updatedReports });
    selectedReportIds.forEach(id => deleteCaseFile(id));
    setSelectedReportIds(new Set());
    toast.success(`${count} report(s) deleted`);
  };

  const handleBulkDeleteDocuments = () => {
    if (!selectedProject) return;
    const count = selectedDocumentIds.size;
    selectedDocumentIds.forEach(id => removeDocumentFromProject(selectedProject.id, id));
    setSelectedDocumentIds(new Set());
    toast.success(`${count} document(s) deleted`);
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
    project.description?.toLowerCase().includes(projectSearchQuery.toLowerCase())
  );

  const getCaseCountForFolder = (folderId: string | "uncategorized") => {
    const nonProjectFiles = caseFiles.filter(file => !file.projectId); // Exclude project reports
    if (folderId === "uncategorized") {
      return nonProjectFiles.filter((file) => !file.folderId).length;
    }
    return nonProjectFiles.filter((file) => file.folderId === folderId).length;
  };

  const exportAsJSON = (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const caseFile = caseFiles.find((file) => file.id === caseId);
    if (!caseFile) return;

    const dataStr = JSON.stringify(caseFile, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${caseFile.caseNumber.replace(/[^a-z0-9]/gi, "_")}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Case file exported as JSON");
  };

  const exportAsPDF = (caseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const caseFile = caseFiles.find((file) => file.id === caseId);
    if (!caseFile) return;

    exportReportToPDF(caseFile);
    toast.success("Report exported to PDF");
  };

  // If project is selected, show clean project view
  if (selectedProject) {
    return (
      <div className="flex h-screen w-full bg-background">
        <Sidebar />
        <main className={cn(
          "flex-1 flex flex-col overflow-y-auto transition-all duration-300",
          isCollapsed ? "ml-16" : "ml-64"
        )}>
          {/* Project Header */}
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedProject(null);
                  setProjectActiveTab("chat");
                }}
              >
                ← Back
              </Button>
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-foreground" />
                <h1 className="text-xl font-semibold text-foreground">{selectedProject.name}</h1>
              </div>
            </div>
            
            {/* Tabs */}
            <div className="flex items-center justify-between gap-4">
              <Tabs value={projectActiveTab} onValueChange={(v) => setProjectActiveTab(v as any)} className="flex-1">
                <TabsList>
                  <TabsTrigger value="chat">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Chat
                  </TabsTrigger>
                  <TabsTrigger value="reports">
                    <FileText className="h-4 w-4 mr-2" />
                    Reports ({selectedProject.reports.length})
                  </TabsTrigger>
                  <TabsTrigger value="documents">
                    <File className="h-4 w-4 mr-2" />
                    Documents ({selectedProject.documents.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              {/* New Chat Button - only show when on chat tab and has messages */}
              {projectActiveTab === "chat" && selectedProject.chatHistory.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewChat}
                >
                  New Chat
                </Button>
              )}
            </div>
          </div>

          {/* Tab Content */}
          {projectActiveTab === "chat" && (
          <div className="flex-1 flex flex-col px-4">
            {selectedProject.chatHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <div className="mb-8 text-center">
                  <h2 className="mb-2 text-3xl font-semibold text-foreground">
                    {selectedProject.name}
                  </h2>
                  {selectedProject.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedProject.description}
                    </p>
                  )}
                </div>

                {/* Documents & Reports Summary */}
                <div className="flex gap-3 mb-6 max-w-2xl w-full">
                  {/* Documents Card */}
                  {selectedProject.documents.length > 0 && (
                    <Card className="flex-1 p-3 hover:border-primary/50 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <File className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">
                          {selectedProject.documents.length} {selectedProject.documents.length === 1 ? 'doc' : 'docs'}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {selectedProject.documents.slice(0, 2).map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => window.open(doc.url, '_blank')}
                            className="text-xs text-muted-foreground hover:text-primary truncate block w-full text-left transition-colors"
                          >
                            • {doc.name}
                          </button>
                        ))}
                        {selectedProject.documents.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            • +{selectedProject.documents.length - 2} more
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                  {/* Reports Card */}
                  <Card className="flex-1 p-3 hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground">
                        {selectedProject.reports.length} {selectedProject.reports.length === 1 ? 'report' : 'reports'}
                      </span>
                    </div>
                    {selectedProject.reports.length > 0 ? (
                      <div className="space-y-1">
                        {selectedProject.reports.slice(0, 2).map((report) => (
                          <div key={report.id} className="text-xs text-muted-foreground truncate">
                            • {report.caseNumber}
                          </div>
                        ))}
                        {selectedProject.reports.length > 2 && (
                          <div className="text-xs text-muted-foreground">
                            • +{selectedProject.reports.length - 2} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">No reports yet</p>
                    )}
                  </Card>
                </div>

                {/* Chat Input */}
                <form onSubmit={handleChatSubmit} className="w-full max-w-3xl">
                  <div className={cn(
                    "relative rounded-lg border bg-card transition-all duration-150",
                    "border-border"
                  )}>
                    <textarea
                      ref={chatTextareaRef}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleChatSubmit(e);
                        }
                      }}
                      placeholder="Ask about your documents, request analysis, or generate reports..."
                      rows={1}
                      className={cn(
                        "w-full resize-none bg-transparent px-4 py-3 pr-12 text-base text-foreground",
                        "placeholder:text-muted-foreground/50",
                        "focus:outline-none max-h-40 overflow-y-auto leading-relaxed"
                      )}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isLoadingChat}
                      className={cn(
                        "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                        chatInput.trim() && !isLoadingChat
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground/30 cursor-not-allowed"
                      )}
                    >
                      {isLoadingChat ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </form>
                
                {/* Suggested Prompts */}
                <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-3xl">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSuggestedPrompt("Give me a news roundup from the last month of everything related to my TechForward project.")}
                    className="text-sm"
                  >
                    News Roundup
                  </Button>
                </div>
                
                {/* Loading Stages */}
                {isLoadingChat && loadingStages.length > 0 && (
                  <div className="mt-6">
                    <LoadingStages stages={loadingStages} duration={750} />
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Chat Messages */}
                <div className="py-8 space-y-6 max-w-4xl mx-auto w-full px-4">
                  {selectedProject.chatHistory.map((message, index) => (
                    <div key={index}>
                      {message.role === "user" ? (
                        <div className="bg-card border border-border rounded-lg p-4 ml-auto max-w-2xl">
                          <p className="text-sm text-foreground">{message.content}</p>
                        </div>
                      ) : message.content === "TAIWAN_REPORT" ? (
                        <TaiwanReport />
                      ) : (
                        <div className="bg-background rounded-lg p-4">
                          <p className="text-sm text-foreground">{message.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoadingChat && (
                    <>
                      {loadingStages.length > 0 ? (
                        <LoadingStages stages={loadingStages} duration={750} />
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Thinking...</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Fixed Input at Bottom */}
                <div className="border-t border-border bg-background py-4">
                  <form onSubmit={handleChatSubmit} className="max-w-4xl mx-auto w-full px-4">
                    <div className={cn(
                      "relative rounded-lg border bg-card transition-all duration-150",
                      "border-border"
                    )}>
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSubmit(e);
                          }
                        }}
                        placeholder="Ask about your documents, request analysis, or generate reports..."
                        rows={1}
                        className={cn(
                          "w-full resize-none bg-transparent px-4 py-3 pr-12 text-base text-foreground",
                          "placeholder:text-muted-foreground/50",
                          "focus:outline-none max-h-40 overflow-y-auto leading-relaxed"
                        )}
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || isLoadingChat}
                        className={cn(
                          "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                          chatInput.trim() && !isLoadingChat
                            ? "text-primary hover:bg-primary/10"
                            : "text-muted-foreground/30 cursor-not-allowed"
                        )}
                      >
                        {isLoadingChat ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </>
            )}
          </div>
          )}

          {/* Reports Tab */}
          {projectActiveTab === "reports" && (
            <div className="p-6">
              {selectedProject.reports.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No reports generated yet.<br/>
                    Use the Chat tab to generate reports.
                  </p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-4">
                  {/* Bulk Actions Toolbar */}
                  <div className="flex items-center justify-between mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleAllReportsSelection}
                    >
                      {selectedReportIds.size === selectedProject.reports.length ? (
                        <>
                          <CheckSquare className="h-4 w-4 mr-2" />
                          Deselect All
                        </>
                      ) : (
                        <>
                          <Square className="h-4 w-4 mr-2" />
                          Select All
                        </>
                      )}
                    </Button>
                    {selectedReportIds.size > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {selectedReportIds.size} selected
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDeleteReports}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {selectedProject.reports.map((report) => (
                    <Card
                      key={report.id}
                      className={cn(
                        "p-4 hover:shadow-md transition-shadow",
                        selectedReportIds.has(report.id) && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReportSelection(report.id);
                            }}
                            className="mt-1"
                          >
                            {selectedReportIds.has(report.id) ? (
                              <CheckSquare className="h-5 w-5 text-primary" />
                            ) : (
                              <Square className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => navigate(`/case/${report.id}`)}
                          >
                          <h3 className="font-semibold text-foreground mb-1">
                            {report.caseNumber}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {report.subject}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(report.timestamp)}</span>
                          </div>
                        </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Report</Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover z-50">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameReport(report.id, report.caseNumber);
                                }}
                                className="cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExportReport(report.id);
                                }}
                                className="cursor-pointer"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Export as PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteReport(report.id);
                                }}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {projectActiveTab === "documents" && (
            <div className="p-6">
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-foreground">Uploaded Documents</h2>
                  <div className="flex items-center gap-2">
                    {selectedDocumentIds.size > 0 && (
                      <>
                        <span className="text-sm text-muted-foreground mr-2">
                          {selectedDocumentIds.size} selected
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleBulkDeleteDocuments}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </>
                    )}
                    <label htmlFor="docs-file-upload">
                      <Button variant="outline" asChild>
                        <span>
                          <Upload className="h-4 w-4 mr-2" />
                          Add files
                        </span>
                      </Button>
                    </label>
                  </div>
                  <input
                    id="docs-file-upload"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {selectedProject.documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64">
                    <File className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      No documents uploaded yet.<br/>
                      Click "Add files" to upload documents.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Select All */}
                    <div className="mb-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleAllDocumentsSelection}
                      >
                        {selectedDocumentIds.size === selectedProject.documents.length ? (
                          <>
                            <CheckSquare className="h-4 w-4 mr-2" />
                            Deselect All
                          </>
                        ) : (
                          <>
                            <Square className="h-4 w-4 mr-2" />
                            Select All
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {selectedProject.documents.map((doc) => (
                      <Card 
                        key={doc.id} 
                        className={cn(
                          "p-4",
                          selectedDocumentIds.has(doc.id) && "border-primary bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <button
                              onClick={() => toggleDocumentSelection(doc.id)}
                            >
                              {selectedDocumentIds.has(doc.id) ? (
                                <CheckSquare className="h-5 w-5 text-primary" />
                              ) : (
                                <Square className="h-5 w-5 text-muted-foreground" />
                              )}
                            </button>
                            <File className="h-5 w-5 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{doc.name}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span>{formatFileSize(doc.size)}</span>
                                <span>•</span>
                                <span>{formatDate(doc.uploadedAt)}</span>
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar />
      <main className={cn(
        "flex-1 overflow-y-auto transition-all duration-300",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        <div className="px-8 py-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-foreground mb-2">Case Files</h1>
            <p className="text-sm text-muted-foreground">
              Access your investigation history, reports, and projects
            </p>
          </div>

          <Tabs defaultValue="people" className="space-y-6">
            <TabsList>
              <TabsTrigger value="people">
                <Users className="h-4 w-4 mr-2" />
                Investigations
              </TabsTrigger>
              <TabsTrigger value="projects">
                <Folder className="h-4 w-4 mr-2" />
                Projects
              </TabsTrigger>
            </TabsList>

            <TabsContent value="people" className="space-y-6">
              {/* Search and Controls */}
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search case files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="min-w-[140px]">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    {sortBy === "date-desc" && "Newest First"}
                    {sortBy === "date-asc" && "Oldest First"}
                    {sortBy === "name" && "By Name"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  <DropdownMenuItem onClick={() => setSortBy("date-desc")} className="cursor-pointer">
                    Newest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("date-asc")} className="cursor-pointer">
                    Oldest First
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortBy("name")} className="cursor-pointer">
                    By Name
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={() => setCreateFolderDialogOpen(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </div>
            
            {/* Bulk Actions Toolbar */}
            {selectedCaseIds.size > 0 && (
              <Card className="p-3 border-primary/50 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCaseIds(new Set())}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium text-foreground">
                      {selectedCaseIds.size} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDeleteCases}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Folder Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedFolder === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFolder("all")}
              >
                All ({caseFiles.filter(f => !f.projectId).length})
              </Button>
              <Button
                variant={selectedFolder === "uncategorized" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFolder("uncategorized")}
              >
                Uncategorized ({getCaseCountForFolder("uncategorized")})
              </Button>
              {folders.map((folder) => (
                <div key={folder.id} className="relative group">
                  <Button
                    variant={selectedFolder === folder.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFolder(folder.id)}
                    className="pr-8"
                  >
                    <Folder className="h-3 w-3 mr-2" />
                    {folder.name} ({getCaseCountForFolder(folder.id)})
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover z-50">
                      <DropdownMenuItem
                        onClick={() => handleRenameFolder(folder.id, folder.name)}
                        className="cursor-pointer"
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </div>

          {/* Case Files Grid */}
          {caseFiles.length === 0 ? (
            <Card className="p-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No case files yet</h3>
              <p className="text-sm text-muted-foreground">
                Start an investigation from the home page to create your first case file.
              </p>
            </Card>
          ) : filteredAndSortedCaseFiles.length === 0 ? (
            <Card className="p-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No matching case files</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search or filter criteria.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Select All Button */}
              {filteredAndSortedCaseFiles.length > 0 && (
                <div className="col-span-full mb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleAllCasesSelection}
                  >
                    {selectedCaseIds.size === filteredAndSortedCaseFiles.length ? (
                      <>
                        <CheckSquare className="h-4 w-4 mr-2" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <Square className="h-4 w-4 mr-2" />
                        Select All
                      </>
                    )}
                  </Button>
                </div>
              )}
              {filteredAndSortedCaseFiles.map((caseFile) => (
                <Card
                  key={caseFile.id}
                  className={cn(
                    "p-5 transition-all duration-150 cursor-pointer group relative",
                    "hover:border-primary/50 hover:shadow-[0_0_15px_rgba(56,189,248,0.1)]",
                    "flex flex-col h-[220px]",
                    selectedCaseIds.has(caseFile.id) && "border-primary bg-primary/5"
                  )}
                  onClick={() => navigate(`/case/${caseFile.id}`)}
                >
                  {/* Checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCaseSelection(caseFile.id);
                    }}
                    className="absolute top-3 left-3 z-10 p-1 rounded hover:bg-background/80 transition-colors"
                  >
                    {selectedCaseIds.has(caseFile.id) ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                  </button>

                  {/* File Icon Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 rounded-lg bg-primary/10 ml-8">
                      <FolderOpen className="h-6 w-6 text-primary" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button
                          className={cn(
                            "rounded-md p-1.5 transition-all duration-150",
                            "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                            "opacity-0 group-hover:opacity-100 focus:opacity-100"
                          )}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 bg-popover z-50">
                        <DropdownMenuItem
                          onClick={(e) => handleRename(caseFile.id, caseFile.caseNumber, e)}
                          className="cursor-pointer"
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                              <MoveRight className="h-4 w-4 mr-2" />
                              Move to Folder
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" className="bg-popover z-50">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveToFolder(caseFile.id, undefined);
                              }}
                              className="cursor-pointer"
                            >
                              Uncategorized
                            </DropdownMenuItem>
                            {folders.map((folder) => (
                              <DropdownMenuItem
                                key={folder.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMoveToFolder(caseFile.id, folder.id);
                                }}
                                className="cursor-pointer"
                              >
                                <Folder className="h-4 w-4 mr-2" />
                                {folder.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <div className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
                              <Download className="h-4 w-4 mr-2" />
                              Export As
                            </div>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent side="right" className="bg-popover z-50">
                            <DropdownMenuItem
                              onClick={(e) => exportAsPDF(caseFile.id, e)}
                              className="cursor-pointer"
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              PDF Document
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => exportAsJSON(caseFile.id, e)}
                              className="cursor-pointer"
                            >
                              <FileJson className="h-4 w-4 mr-2" />
                              JSON File
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenuItem
                          onClick={(e) => handleDelete(caseFile.id, e)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* File Content */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-base font-semibold text-foreground mb-2 line-clamp-2">
                      {caseFile.caseNumber}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">
                      {caseFile.subject}
                    </p>
                    
                    {/* File Footer */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(caseFile.timestamp)}</span>
                      </div>
                      {caseFile.messages.some(m => m.isReport || m.isRussellCherryReport) && (
                        <Badge variant="outline" className="text-xs w-fit">
                          Report Generated
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
            </TabsContent>

            <TabsContent value="projects" className="space-y-6">
              {/* Projects Search and Create */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setCreateProjectDialogOpen(true)}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </div>

              {/* Projects Grid */}
              {projects.length === 0 ? (
                <Card className="p-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first project to organize documents and generate reports.
                  </p>
                  <Button onClick={() => setCreateProjectDialogOpen(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create Project
                  </Button>
                </Card>
              ) : filteredProjects.length === 0 ? (
                <Card className="p-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No matching projects</h3>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your search criteria.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="p-6 cursor-pointer hover:border-primary/50 transition-all group"
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <FolderOpen className="h-6 w-6 text-primary" />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(project.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <h3 className="text-base font-semibold text-foreground mb-2">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {project.description}
                        </p>
                      )}
                      <div className="space-y-2 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <File className="h-3 w-3" />
                          <span>{project.documents.length} documents</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          <span>{project.reports.length} reports</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(project.timestamp)}</span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Case File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this case file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Rename Case File</DialogTitle>
            <DialogDescription>
              Enter a new name for this case file.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newCaseName}
            onChange={(e) => setNewCaseName(e.target.value)}
            placeholder="Case name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                confirmRename();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={createFolderDialogOpen} onOpenChange={setCreateFolderDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Enter a name for your new folder to organize case files.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateFolder();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Folder Dialog */}
      <AlertDialog open={deleteFolderDialogOpen} onOpenChange={setDeleteFolderDialogOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this folder? Case files inside will be moved to uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteFolder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameFolderDialogOpen} onOpenChange={setRenameFolderDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for this folder.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                confirmRenameFolder();
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRenameFolder}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={createProjectDialogOpen} onOpenChange={setCreateProjectDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a project to organize documents and generate investigation reports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project Name</label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
              <Textarea
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="Enter project description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProjectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject}>
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? All documents and reports will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CaseFiles;
