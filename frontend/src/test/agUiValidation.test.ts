import { describe, it, expect } from "vitest";
import {
  isValidMessage,
  parseAgUiPacket,
  parseAgUiPacketSafe,
} from "../lib/agUiValidation";
import type { Message } from "@/types/chat";

describe("agUiValidation", () => {
  describe("isValidMessage", () => {
    it("accepts valid user message", () => {
      const msg: Message = { id: "1", role: "user", content: "Hi" };
      expect(isValidMessage(msg)).toBe(true);
    });

    it("accepts valid assistant message", () => {
      const msg: Message = { id: "2", role: "assistant", content: "Hello" };
      expect(isValidMessage(msg)).toBe(true);
    });

    it("rejects object without id", () => {
      expect(isValidMessage({ role: "user", content: "Hi" })).toBe(false);
    });

    it("rejects object with empty id", () => {
      expect(isValidMessage({ id: "", role: "user", content: "Hi" })).toBe(
        false
      );
    });

    it("rejects object with invalid role", () => {
      expect(
        isValidMessage({ id: "1", role: "invalid", content: "Hi" })
      ).toBe(false);
    });

    it("rejects null and non-objects", () => {
      expect(isValidMessage(null)).toBe(false);
      expect(isValidMessage(undefined)).toBe(false);
      expect(isValidMessage("string")).toBe(false);
      expect(isValidMessage([])).toBe(false);
    });

    it("accepts valid tool message with toolCallId", () => {
      const msg: Message = {
        id: "t1",
        role: "tool",
        content: "result",
        toolCallId: "call_1",
      };
      expect(isValidMessage(msg)).toBe(true);
    });

    it("rejects tool message without toolCallId", () => {
      expect(
        isValidMessage({ id: "t1", role: "tool", content: "result" })
      ).toBe(false);
    });
  });

  describe("parseAgUiPacket", () => {
    it("parses array of valid messages", () => {
      const payload: Message[] = [
        { id: "1", role: "user", content: "Hi" },
        { id: "2", role: "assistant", content: "Hello" },
      ];
      expect(parseAgUiPacket(payload)).toEqual(payload);
    });

    it("parses { messages: Message[] } shape", () => {
      const messages: Message[] = [
        { id: "1", role: "user", content: "Hi" },
        { id: "2", role: "assistant", content: "Hello" },
      ];
      expect(parseAgUiPacket({ messages })).toEqual(messages);
    });

    it("throws on null or undefined", () => {
      expect(() => parseAgUiPacket(null)).toThrow("null or undefined");
      expect(() => parseAgUiPacket(undefined)).toThrow("null or undefined");
    });

    it("throws on non-array non-messages-object", () => {
      expect(() => parseAgUiPacket({ foo: "bar" })).toThrow(
        "must be an array of messages"
      );
      expect(() => parseAgUiPacket("not an array")).toThrow(
        "must be an array of messages"
      );
    });

    it("throws on array with invalid message at index", () => {
      const payload = [
        { id: "1", role: "user", content: "Hi" },
        { id: "2", role: "invalid" },
      ];
      expect(() => parseAgUiPacket(payload)).toThrow("invalid message at index 1");
    });
  });

  describe("parseAgUiPacketSafe", () => {
    it("returns parsed messages for valid payload", () => {
      const payload: Message[] = [
        { id: "1", role: "user", content: "Hi" },
      ];
      expect(parseAgUiPacketSafe(payload)).toEqual(payload);
    });

    it("returns null for malformed payload", () => {
      expect(parseAgUiPacketSafe(null)).toBeNull();
      expect(parseAgUiPacketSafe([{ role: "user", content: "Hi" }])).toBeNull();
      expect(parseAgUiPacketSafe("not valid")).toBeNull();
    });
  });
});
