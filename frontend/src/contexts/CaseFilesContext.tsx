import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface CaseFile {
  id: string;
  caseNumber: string;
  subject: string;
  timestamp: number;
  folderId?: string;
  category?: "Russell Cherry" | "Roman Abramovich" | "Iranian Petrochemicals" | "Other";
  projectId?: string; // Link to project if this is a project report
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    isReport?: boolean;
    isAccountSelector?: boolean;
    isRussellCherryReport?: boolean;
    isTaiwanReport?: boolean;
    isDarkWebReport?: boolean;
    isIranianPetrochemicalsReport?: boolean;
    selectedAccount?: string;
  }>;
}

export interface ProjectDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: number;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  documents: ProjectDocument[];
  reports: CaseFile[];
  chatHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

export interface Folder {
  id: string;
  name: string;
  timestamp: number;
  color?: string;
}

interface CaseFilesContextType {
  caseFiles: CaseFile[];
  folders: Folder[];
  projects: Project[];
  addCaseFile: (caseFile: CaseFile) => void;
  getCaseFile: (id: string) => CaseFile | undefined;
  deleteCaseFile: (id: string) => void;
  renameCaseFile: (id: string, newName: string) => void;
  moveCaseToFolder: (caseId: string, folderId: string | undefined) => void;
  createFolder: (name: string) => void;
  deleteFolder: (id: string) => void;
  renameFolder: (id: string, newName: string) => void;
  createProject: (name: string, description?: string) => void;
  getProject: (id: string) => Project | undefined;
  deleteProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  addDocumentToProject: (projectId: string, document: ProjectDocument) => void;
  removeDocumentFromProject: (projectId: string, documentId: string) => void;
  addReportToProject: (projectId: string, report: CaseFile) => void;
  addChatMessageToProject: (projectId: string, message: { role: "user" | "assistant"; content: string }) => void;
}

const CaseFilesContext = createContext<CaseFilesContextType | undefined>(undefined);

export const CaseFilesProvider = ({ children }: { children: ReactNode }) => {
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>(() => {
    const stored = localStorage.getItem("sidney-case-files");
    return stored ? JSON.parse(stored) : [];
  });

  const [folders, setFolders] = useState<Folder[]>(() => {
    const stored = localStorage.getItem("sidney-folders");
    return stored ? JSON.parse(stored) : [];
  });

  const [projects, setProjects] = useState<Project[]>(() => {
    // Default projects that should always exist
    const defaultProjects: Project[] = [
      {
        id: "techforward-default",
        name: "TechForward",
        description: "TechForward Solutions intelligence project",
        timestamp: Date.now(),
        documents: [
          {
            id: "doc-intelligence-needs",
            name: "Intelligence_Needs.pdf",
            size: 0,
            type: "application/pdf",
            uploadedAt: Date.now(),
            url: "/documents/Intelligence_Needs.pdf"
          },
          {
            id: "doc-techforward-overview",
            name: "TechForward_Solutions_Overview.pdf",
            size: 0,
            type: "application/pdf",
            uploadedAt: Date.now(),
            url: "/documents/TechForward_Solutions_Overview.pdf"
          }
        ],
        reports: [],
        chatHistory: []
      },
      {
        id: "humanitarian-aid-default",
        name: "Humanitarian Aid",
        description: "NGO deployment and threat mapping operations",
        timestamp: Date.now(),
        documents: [],
        reports: [],
        chatHistory: []
      }
    ];

    const stored = localStorage.getItem("sidney-projects");
    if (stored) {
      const storedProjects = JSON.parse(stored);
      // Check if default projects already exist
      const hasTechForward = storedProjects.some((p: Project) => p.id === "techforward-default");
      const hasHumanitarianAid = storedProjects.some((p: Project) => p.id === "humanitarian-aid-default");
      
      if (hasTechForward && hasHumanitarianAid) {
        return storedProjects;
      }
      
      // Add missing default projects
      const projectsToAdd = [];
      if (!hasTechForward) projectsToAdd.push(defaultProjects[0]);
      if (!hasHumanitarianAid) projectsToAdd.push(defaultProjects[1]);
      
      return [...projectsToAdd, ...storedProjects];
    }
    // No stored projects, return defaults
    return defaultProjects;
  });

  useEffect(() => {
    localStorage.setItem("sidney-case-files", JSON.stringify(caseFiles));
  }, [caseFiles]);

  useEffect(() => {
    localStorage.setItem("sidney-folders", JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem("sidney-projects", JSON.stringify(projects));
  }, [projects]);

  const addCaseFile = (caseFile: CaseFile) => {
    setCaseFiles(prev => [caseFile, ...prev]);
  };

  const getCaseFile = (id: string) => {
    // First check global case files
    const globalFile = caseFiles.find(file => file.id === id);
    if (globalFile) return globalFile;
    
    // Then check all project reports
    for (const project of projects) {
      const projectReport = project.reports.find(report => report.id === id);
      if (projectReport) return projectReport;
    }
    
    return undefined;
  };

  const deleteCaseFile = (id: string) => {
    setCaseFiles(prev => prev.filter(file => file.id !== id));
  };

  const renameCaseFile = (id: string, newName: string) => {
    setCaseFiles(prev => prev.map(file => 
      file.id === id ? { ...file, caseNumber: newName } : file
    ));
  };

  const moveCaseToFolder = (caseId: string, folderId: string | undefined) => {
    setCaseFiles(prev => prev.map(file =>
      file.id === caseId ? { ...file, folderId } : file
    ));
  };

  const createFolder = (name: string) => {
    const newFolder: Folder = {
      id: Date.now().toString(),
      name,
      timestamp: Date.now(),
    };
    setFolders(prev => [newFolder, ...prev]);
  };

  const deleteFolder = (id: string) => {
    // Move all cases in this folder to uncategorized
    setCaseFiles(prev => prev.map(file =>
      file.folderId === id ? { ...file, folderId: undefined } : file
    ));
    setFolders(prev => prev.filter(folder => folder.id !== id));
  };

  const renameFolder = (id: string, newName: string) => {
    setFolders(prev => prev.map(folder =>
      folder.id === id ? { ...folder, name: newName } : folder
    ));
  };

  // Project management functions
  const createProject = (name: string, description?: string) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name,
      description,
      timestamp: Date.now(),
      documents: [],
      reports: [],
      chatHistory: []
    };
    setProjects(prev => [newProject, ...prev]);
  };

  const getProject = (id: string) => {
    return projects.find(project => project.id === id);
  };

  const deleteProject = (id: string) => {
    setProjects(prev => prev.filter(project => project.id !== id));
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(project =>
      project.id === id ? { ...project, ...updates } : project
    ));
  };

  const addDocumentToProject = (projectId: string, document: ProjectDocument) => {
    setProjects(prev => prev.map(project =>
      project.id === projectId 
        ? { ...project, documents: [document, ...project.documents] }
        : project
    ));
  };

  const removeDocumentFromProject = (projectId: string, documentId: string) => {
    setProjects(prev => prev.map(project =>
      project.id === projectId
        ? { ...project, documents: project.documents.filter(doc => doc.id !== documentId) }
        : project
    ));
  };

  const addReportToProject = (projectId: string, report: CaseFile) => {
    setProjects(prev => prev.map(project =>
      project.id === projectId
        ? { ...project, reports: [report, ...project.reports] }
        : project
    ));
  };

  const addChatMessageToProject = (projectId: string, message: { role: "user" | "assistant"; content: string }) => {
    setProjects(prev => prev.map(project =>
      project.id === projectId
        ? { ...project, chatHistory: [...project.chatHistory, message] }
        : project
    ));
  };

  return (
    <CaseFilesContext.Provider value={{ 
      caseFiles, 
      folders,
      projects,
      addCaseFile, 
      getCaseFile, 
      deleteCaseFile, 
      renameCaseFile,
      moveCaseToFolder,
      createFolder,
      deleteFolder,
      renameFolder,
      createProject,
      getProject,
      deleteProject,
      updateProject,
      addDocumentToProject,
      removeDocumentFromProject,
      addReportToProject,
      addChatMessageToProject
    }}>
      {children}
    </CaseFilesContext.Provider>
  );
};

export const useCaseFiles = () => {
  const context = useContext(CaseFilesContext);
  if (!context) {
    throw new Error("useCaseFiles must be used within CaseFilesProvider");
  }
  return context;
};
