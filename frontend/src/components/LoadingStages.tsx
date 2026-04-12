import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface LoadingStagesProps {
  stages: string[];
  duration?: number; // duration per stage in ms (used when no progress provided)
  progress?: number; // 0–100, drives the progress bar
}

export const LoadingStages = ({ stages, duration = 1500, progress }: LoadingStagesProps) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    setCurrentStageIndex(0);
  }, [stages]);

  useEffect(() => {
    if (progress !== undefined) return; // real progress drives stage cycling, skip timer
    if (currentStageIndex < stages.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStageIndex(prev => prev + 1);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [currentStageIndex, stages.length, duration, progress]);

  const label = stages[currentStageIndex];

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        <span className="text-sm text-foreground flex-1">{label}</span>
        {progress !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
        )}
      </div>
      {progress !== undefined && (
        <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
