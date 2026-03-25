// src/hooks/useInvestigation.ts
import { useState, useRef } from "react";
import { apiClient } from "@/api/api";

export const useInvestigation = () => {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const start = async (query: string) => {
    abortControllerRef.current = new AbortController();

    try {
      const { id } = await apiClient.investigate.start(query, {
        signal: abortControllerRef.current.signal,
      });
      setActiveTaskId(id);
      return id;
    } catch (err) {
      if (err.name !== "CanceledError") throw err;
    }
  };

  const stop = async () => {
    abortControllerRef.current?.abort();

    if (activeTaskId) {
      await apiClient.investigate.terminate(activeTaskId);
      setActiveTaskId(null);
    }
  };

  return { start, stop, activeTaskId };
};
