/**
 * Validation and parsing of AG-UI messages and packets.
 * Used to handle malformed AG-UI payloads safely.
 */

import type { Message, MessageRole } from "@/types/chat";

const VALID_ROLES: MessageRole[] = [
  "user",
  "assistant",
  "system",
  "tool",
  "activity",
  "developer",
];

function isNonEmptyString(x: unknown): x is string {
  return typeof x === "string" && x.length > 0;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Type guard: checks if a value is a valid AG-UI Message.
 */
export function isValidMessage(obj: unknown): obj is Message {
  if (!isRecord(obj)) return false;
  if (!isNonEmptyString(obj.id)) return false;
  if (!VALID_ROLES.includes(obj.role as MessageRole)) return false;

  switch (obj.role) {
    case "user":
      return (
        typeof obj.content === "string" ||
        (Array.isArray(obj.content) &&
          obj.content.every(
            (c) =>
              isRecord(c) &&
              (c.type === "text" ? typeof (c as { text?: unknown }).text === "string" : c.type === "binary")
          ))
      );
    case "assistant":
      return obj.content === undefined || typeof obj.content === "string";
    case "system":
    case "developer":
      return typeof obj.content === "string";
    case "tool":
      return typeof obj.content === "string" && isNonEmptyString(obj.toolCallId);
    case "activity":
      return isNonEmptyString(obj.activityType) && isRecord(obj.content);
    default:
      return false;
  }
}

/**
 * Parse an AG-UI packet (e.g. backend response) into an array of messages.
 * Returns parsed messages or throws with a descriptive error for malformed data.
 */
export function parseAgUiPacket(payload: unknown): Message[] {
  if (payload === null || payload === undefined) {
    throw new Error("AG-UI packet is null or undefined");
  }
  if (!Array.isArray(payload)) {
    if (isRecord(payload) && Array.isArray((payload as { messages?: unknown }).messages)) {
      const inner = (payload as { messages: unknown }).messages;
      return parseAgUiPacket(inner);
    }
    throw new Error("AG-UI packet must be an array of messages or { messages: Message[] }");
  }
  const out: Message[] = [];
  for (let i = 0; i < payload.length; i++) {
    const item = payload[i];
    if (!isValidMessage(item)) {
      throw new Error(
        `AG-UI packet invalid message at index ${i}: expected id (string), role (MessageRole), and role-specific content`
      );
    }
    out.push(item);
  }
  return out;
}

/**
 * Safe parse: returns messages if valid, or null if malformed (no throw).
 */
export function parseAgUiPacketSafe(payload: unknown): Message[] | null {
  try {
    return parseAgUiPacket(payload);
  } catch {
    return null;
  }
}
