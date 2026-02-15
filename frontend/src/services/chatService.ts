/**
 * Chat service: message ingestion and outgoing payloads aligned with AG-UI.
 * Handles building/adding messages and preparing payloads for the backend.
 */

import type { Message, UserMessage, AssistantMessage, Chat } from "@/types/chat";

/** Generate a unique id for messages/runs (AG-UI expects string ids). */
export function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createThreadId(): string {
  return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ---- Message ingestion ----

/**
 * Build a user message from plain text (AG-UI UserMessage).
 */
export function createUserMessage(content: string, name?: string): UserMessage {
  return {
    id: createMessageId(),
    role: "user",
    content,
    ...(name && { name }),
  };
}

/**
 * Build an assistant message from plain text (AG-UI AssistantMessage).
 */
export function createAssistantMessage(
  content: string,
  options?: { name?: string; toolCalls?: AssistantMessage["toolCalls"] }
): AssistantMessage {
  return {
    id: createMessageId(),
    role: "assistant",
    ...(content && { content }),
    ...(options?.name && { name: options.name }),
    ...(options?.toolCalls?.length && { toolCalls: options.toolCalls }),
  };
}

/**
 * Append a user message to a message list (ingestion).
 */
export function appendUserMessage(messages: Message[], content: string, name?: string): Message[] {
  const userMsg = createUserMessage(content, name);
  return [...messages, userMsg];
}

/**
 * Append an assistant message to a message list (ingestion).
 */
export function appendAssistantMessage(
  messages: Message[],
  content: string,
  options?: { name?: string; toolCalls?: AssistantMessage["toolCalls"] }
): Message[] {
  const assistantMsg = createAssistantMessage(content, options);
  return [...messages, assistantMsg];
}

// ---- Outgoing payloads ----

/**
 * Payload sent to the backend to start a run (AG-UI-style input).
 */
export interface ChatRunInput {
  threadId: string;
  runId: string;
  messages: Message[];
}

/**
 * Build the outgoing payload for a chat/agent run.
 * Use this when calling your backend (e.g. POST /chat or /agent/run).
 */
export function buildRunInput(
  threadId: string,
  messages: Message[],
  runId?: string
): ChatRunInput {
  return {
    threadId,
    runId: runId ?? createRunId(),
    messages,
  };
}

/**
 * Create a new chat (thread) with optional initial messages.
 */
export function createChat(threadId?: string, initialMessages: Message[] = []): Chat {
  const id = threadId ?? createThreadId();
  return {
    id,
    threadId: id,
    messages: [...initialMessages],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Add a message to a chat and return an updated chat (immutable).
 */
export function addMessageToChat(chat: Chat, message: Message): Chat {
  return {
    ...chat,
    messages: [...chat.messages, message],
    updatedAt: Date.now(),
  };
}
