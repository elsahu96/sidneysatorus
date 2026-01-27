import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface LoadingStagesProps {
  stages: string[];
  duration?: number; // duration per stage in ms
}

export const LoadingStages = ({ stages, duration = 1500 }: LoadingStagesProps) => {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    setCurrentStageIndex(0);
  }, [stages]);

  useEffect(() => {
    if (currentStageIndex < stages.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStageIndex(prev => prev + 1);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [currentStageIndex, stages.length, duration]);

  return (
    <div className="flex items-center gap-3">
      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      <span className="text-sm text-foreground">
        {stages[currentStageIndex]}
      </span>
    </div>
  );
};
