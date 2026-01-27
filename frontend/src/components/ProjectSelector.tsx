import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Project } from "@/contexts/CaseFilesContext";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";

interface ProjectSelectorProps {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
}

export const ProjectSelector = ({ projects, selectedProject, onSelectProject }: ProjectSelectorProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm transition-all hover:border-primary hover:bg-card/80",
            selectedProject && "border-primary/50"
          )}
        >
          <span className="text-foreground/80">
            {selectedProject ? selectedProject.name : "Select a project"}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => {
                onSelectProject(project);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-all hover:bg-accent",
                selectedProject?.id === project.id && "bg-accent"
              )}
            >
              <div className="flex flex-col items-start">
                <span className="font-medium text-foreground">{project.name}</span>
                {project.description && (
                  <span className="text-xs text-muted-foreground">{project.description}</span>
                )}
              </div>
              {selectedProject?.id === project.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
