/**
 * AG-UI (Agent User Interaction Protocol) aligned types for chat and messages.
 * @see https://docs.ag-ui.com/concepts/messages
 * @see https://docs.ag-ui.com/concepts/events
 */

// ---- Base & roles ----

/** Role discriminator for messages (AG-UI standard). */
export type MessageRole = "user" | "assistant" | "system" | "tool" | "activity" | "developer";

/** Base shape shared by all message types. */
export interface BaseMessage {
  id: string;
  role: MessageRole;
  content?: string;
  name?: string;
}

// ---- Input content (multimodal) ----

export interface TextInputContent {
  type: "text";
  text: string;
}

export interface BinaryInputContent {
  type: "binary";
  mimeType: string;
  id?: string;
  url?: string;
  data?: string;
  filename?: string;
}

export type InputContent = TextInputContent | BinaryInputContent;

// ---- Message types ----

export interface UserMessage extends Omit<BaseMessage, "content"> {
  role: "user";
  content: string | InputContent[];
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AssistantMessage extends BaseMessage {
  role: "assistant";
  content?: string;
  name?: string;
  toolCalls?: ToolCall[];
}

export interface SystemMessage extends BaseMessage {
  role: "system";
  content: string;
  name?: string;
}

export interface ToolMessage extends BaseMessage {
  role: "tool";
  content: string;
  toolCallId: string;
}

export interface ActivityMessage extends Omit<BaseMessage, "content"> {
  role: "activity";
  activityType: string;
  content: Record<string, unknown>;
}

export interface DeveloperMessage extends BaseMessage {
  role: "developer";
  content: string;
  name?: string;
}

/** Union of all AG-UI message types. */
export type Message =
  | UserMessage
  | AssistantMessage
  | SystemMessage
  | ToolMessage
  | ActivityMessage
  | DeveloperMessage;

// ---- Chat / thread ----

/** A chat thread: conversation container with AG-UI messages. */
export interface Chat {
  id: string;
  threadId: string;
  messages: Message[];
  createdAt?: number;
  updatedAt?: number;
}

// ---- Run lifecycle (for outgoing payloads) ----

export interface RunStartedEvent {
  type: "run_started";
  threadId: string;
  runId: string;
  parentRunId?: string;
  input?: { messages?: Message[] };
}

export interface RunFinishedEvent {
  type: "run_finished";
  threadId: string;
  runId: string;
  result?: unknown;
}

export interface RunErrorEvent {
  type: "run_error";
  message: string;
  code?: string;
}

// ---- Streaming text events ----

export interface TextMessageStartEvent {
  type: "text_message_start";
  messageId: string;
  role: string;
}

export interface TextMessageContentEvent {
  type: "text_message_content";
  messageId: string;
  delta: string;
}

export interface TextMessageEndEvent {
  type: "text_message_end";
  messageId: string;
}

export type AgUiEvent =
  | RunStartedEvent
  | RunFinishedEvent
  | RunErrorEvent
  | TextMessageStartEvent
  | TextMessageContentEvent
  | TextMessageEndEvent;
