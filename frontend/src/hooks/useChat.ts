/**
 * useChat: AG-UI protocol chat hook.
 * Handles send/receive, message history persistence, and connection status.
 */

import { useState, useCallback, useEffect } from "react";
import type { Message, Chat } from "@/types/chat";
import {
  createUserMessage,
  createThreadId,
  buildRunInput,
  type ChatRunInput,
} from "@/services/chatService";
import { parseAgUiPacketSafe } from "@/lib/agUiValidation";

const STORAGE_KEY_PREFIX = "agui_chat_";

export type ChatStatus = "idle" | "loading" | "success" | "error";

export interface UseChatOptions {
  /** Thread id. If not provided, a new one is generated. */
  threadId?: string;
  /** Initial messages (e.g. restored from persistence). */
  initialMessages?: Message[];
  /** Persist messages to localStorage under this thread id. Default true. */
  persist?: boolean;
  /**
   * Transport: send AG-UI run input and return new assistant message(s).
   * If not provided, sendMessage will only append the user message and set success (no backend).
   */
  transport?: (input: ChatRunInput) => Promise<Message[] | unknown>;
}

export interface UseChatReturn {
  messages: Message[];
  status: ChatStatus;
  error: string | null;
  threadId: string;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
  reset: (newThreadId?: string) => void;
}

function loadPersistedMessages(threadId: string): Message[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + threadId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { messages?: unknown; updatedAt?: number };
    if (!parsed?.messages || !Array.isArray(parsed.messages)) return null;
    const validated = parseAgUiPacketSafe(parsed.messages);
    return validated ?? null;
  } catch {
    return null;
  }
}

function savePersistedMessages(threadId: string, messages: Message[]): void {
  try {
    localStorage.setItem(
      STORAGE_KEY_PREFIX + threadId,
      JSON.stringify({ messages, updatedAt: Date.now() })
    );
  } catch {
    // ignore storage errors
  }
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    threadId: initialThreadId,
    initialMessages = [],
    persist = true,
    transport,
  } = options;

  const [threadId, setThreadId] = useState<string>(() => {
    const id = initialThreadId ?? createThreadId();
    if (persist) {
      const loaded = loadPersistedMessages(id);
      if (loaded && loaded.length > 0) return id;
    }
    return id;
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    if (initialThreadId && persist) {
      const loaded = loadPersistedMessages(initialThreadId);
      if (loaded && loaded.length > 0) return loaded;
    }
    return initialMessages.length > 0 ? initialMessages : [];
  });

  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Persist whenever messages or threadId changes
  useEffect(() => {
    if (persist && messages.length > 0) {
      savePersistedMessages(threadId, messages);
    }
  }, [persist, threadId, messages]);

  const clearError = useCallback(() => {
    setError(null);
    if (status === "error") setStatus("idle");
  }, [status]);

  const reset = useCallback(
    (newThreadId?: string) => {
      const id = newThreadId ?? createThreadId();
      setThreadId(id);
      setMessages([]);
      setStatus("idle");
      setError(null);
      if (persist) {
        try {
          localStorage.removeItem(STORAGE_KEY_PREFIX + id);
        } catch {
          // ignore
        }
      }
    },
    [persist]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      const userMsg = createUserMessage(trimmed);
      setMessages((prev) => [...prev, userMsg]);
      setStatus("loading");
      setError(null);

      if (persist) {
        savePersistedMessages(threadId, [...messages, userMsg]);
      }

      if (!transport) {
        setStatus("success");
        return;
      }

      try {
        const runInput = buildRunInput(threadId, [...messages, userMsg]);
        const result = await transport(runInput);

        const newMessages = Array.isArray(result)
          ? result
          : parseAgUiPacketSafe(result);
        if (newMessages == null) {
          setError("Invalid AG-UI response: no messages returned");
          setStatus("error");
        } else {
          if (newMessages.length > 0) {
            setMessages((prev) => [...prev, ...newMessages]);
          }
          setStatus("success");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Request failed";
        setError(message);
        setStatus("error");
      }
    },
    [threadId, messages, transport, persist]
  );

  return {
    messages,
    status,
    error,
    threadId,
    sendMessage,
    clearError,
    reset,
  };
}
