import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";
import type { Message } from "@/types/chat";
import type { ChatRunInput } from "@/services/chatService";

const STORAGE_KEY_PREFIX = "agui_chat_";

describe("useChat", () => {
  beforeEach(() => {
    // Clear localStorage for each test
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) localStorage.removeItem(key);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful message delivery", () => {
    it("appends user message and then assistant message when transport returns valid AG-UI messages", async () => {
      const assistantReply: Message = {
        id: "msg_assistant_1",
        role: "assistant",
        content: "Hello back!",
      };

      const transport = vi.fn().mockResolvedValue([assistantReply]);

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.status).toBe("idle");

      await act(async () => {
        result.current.sendMessage("Hello");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("success");
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("Hello");
      expect(result.current.messages[1].role).toBe("assistant");
      expect(result.current.messages[1].content).toBe("Hello back!");
      expect(transport).toHaveBeenCalledTimes(1);
      const input = transport.mock.calls[0][0] as ChatRunInput;
      expect(input.messages).toHaveLength(1);
      expect(input.messages[0].role).toBe("user");
      expect(input.messages[0].content).toBe("Hello");
    });

    it("sets status to loading while transport is in flight", async () => {
      let resolveTransport: (value: Message[]) => void;
      const transportPromise = new Promise<Message[]>((resolve) => {
        resolveTransport = resolve;
      });
      const transport = vi.fn().mockReturnValue(transportPromise);

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      act(() => {
        result.current.sendMessage("Hi");
      });

      expect(result.current.status).toBe("loading");
      expect(result.current.messages).toHaveLength(1);

      await act(async () => {
        resolveTransport!([
          {
            id: "msg_a",
            role: "assistant",
            content: "Hi there",
          },
        ]);
      });

      await waitFor(() => {
        expect(result.current.status).toBe("success");
      });
      expect(result.current.messages).toHaveLength(2);
    });

    it("without transport, only appends user message and sets success", async () => {
      const { result } = renderHook(() => useChat({ persist: false }));

      await act(async () => {
        result.current.sendMessage("Hello");
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("user");
      expect(result.current.messages[0].content).toBe("Hello");
      expect(result.current.status).toBe("success");
    });
  });

  describe("malformed AG-UI packets", () => {
    it("sets error and status error when transport returns non-array and not parseable", async () => {
      const transport = vi.fn().mockResolvedValue({ notMessages: true });

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      await act(async () => {
        result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
      });

      expect(result.current.error).toContain("Invalid AG-UI response");
      expect(result.current.messages).toHaveLength(1);
    });

    it("sets error when transport returns empty array", async () => {
      const transport = vi.fn().mockResolvedValue([]);

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      await act(async () => {
        result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
      });

      expect(result.current.error).toContain("no messages returned");
      expect(result.current.messages).toHaveLength(1);
    });

    it("sets error when transport throws", async () => {
      const transport = vi.fn().mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      await act(async () => {
        result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
      });

      expect(result.current.error).toBe("Network error");
      expect(result.current.messages).toHaveLength(1);
    });

    it("accepts { messages: Message[] } packet shape from transport", async () => {
      const assistantReply: Message = {
        id: "msg_a1",
        role: "assistant",
        content: "Reply",
      };
      const transport = vi.fn().mockResolvedValue({ messages: [assistantReply] });

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      await act(async () => {
        result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("success");
      });

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[1].content).toBe("Reply");
    });
  });

  describe("state updates when a new message arrives", () => {
    it("updates messages when transport returns new messages", async () => {
      const transport = vi.fn().mockResolvedValue([
        {
          id: "msg_1",
          role: "assistant",
          content: "First",
        },
        {
          id: "msg_2",
          role: "assistant",
          content: "Second",
        },
      ]);

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      await act(async () => {
        result.current.sendMessage("Hello");
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(3);
      });

      expect(result.current.messages[1].content).toBe("First");
      expect(result.current.messages[2].content).toBe("Second");
    });

    it("clearError resets error and status from error to idle", async () => {
      const transport = vi.fn().mockRejectedValue(new Error("Fail"));

      const { result } = renderHook(() =>
        useChat({ persist: false, transport })
      );

      await act(async () => {
        result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.status).toBe("idle");
    });

    it("reset clears messages and creates new thread", () => {
      const { result } = renderHook(() =>
        useChat({
          persist: false,
          initialMessages: [
            { id: "m1", role: "user", content: "Hi" },
            { id: "m2", role: "assistant", content: "Hello" },
          ],
        })
      );

      expect(result.current.messages).toHaveLength(2);

      act(() => {
        result.current.reset();
      });

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
    });
  });

  describe("message history persistence", () => {
    it("persists messages to localStorage when persist is true", async () => {
      const transport = vi.fn().mockResolvedValue([
        { id: "a1", role: "assistant", content: "OK" },
      ]);

      const { result } = renderHook(() =>
        useChat({ persist: true, transport })
      );

      await act(async () => {
        result.current.sendMessage("Test");
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      const key = Object.keys(localStorage).find((k) =>
        k.startsWith(STORAGE_KEY_PREFIX)
      );
      expect(key).toBeDefined();
      const stored = JSON.parse(localStorage.getItem(key!)!);
      expect(stored.messages).toHaveLength(2);
      expect(stored.messages[0].content).toBe("Test");
      expect(stored.messages[1].content).toBe("OK");
    });
  });
});
