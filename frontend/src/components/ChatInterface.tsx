import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { InvestigationReport } from "@/components/InvestigationReport";
import { XAccountSelector } from "@/components/XAccountSelector";
import { RussellCherryReport } from "@/components/RussellCherryReport";
import { LoadingStages } from "@/components/LoadingStages";
import { useCaseFiles, type CaseFile } from "@/contexts/CaseFilesContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiClient, API_BASE_URL } from "@/lib/api";
import type { ReportMetadata, GeolocationItem, ReportSource } from "@/types/index";
import type { ReferenceItem } from "@/components/InvestigationReferences";
import { MessageBubble } from "@/components/MessageBubble";
import { ReportContent } from "@/components/ReportContent";
import { useChat, type UseChatOptions } from "@/hooks/useChat";
import { createMessageId } from "@/services/chatService";
import type { Message as AgUiMessage } from "@/types/chat";
import type { ChatRunInput } from "@/services/chatService";


/** Renders the markdown report content returned by the /report/{stem} endpoint. */
export const InvestigationApiReport = ({
  content,
  geolocations,
  references,
}: {
  content: string;
  geolocations?: GeolocationItem[];
  references?: ReferenceItem[];
}) => (
  <ReportContent
    content={content || "No report content."}
    enhanced={true}
    references={references ?? []}
    geolocations={geolocations}
  />
);

/** Attachment data for rich assistant messages (investigation report, account selector, etc.) */
interface MessageAttachment {
  /** Markdown content loaded from the report JSON file. */
  reportContent?: string;
  geolocations?: GeolocationItem[];
  references?: ReferenceItem[];
  /** File-path metadata kept for future actions (download, case linking). */
  md_path?: string;
  json_path?: string;
  isReport?: boolean;
  isAccountSelector?: boolean;
  isRussellCherryReport?: boolean;
  isIranianPetrochemicalsReport?: boolean;
  isInvestigationApiReport?: boolean;
  selectedAccount?: string;
}

/** Pending report added after account selection (not from useChat) */
interface PendingReport {
  id: string;
  role: "assistant";
  content: string;
  selectedAccount?: string;
}

function getInvestigationErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (
      typeof err.response?.data === "string" &&
      /<!doctype html>|<html/i.test(err.response.data)
    ) {
      return `API returned HTML instead of JSON. Check VITE_API_URL (${API_BASE_URL}) and ensure backend is running.`;
    }
    if (typeof err.response?.data === "string" && err.response.data.trim()) {
      return err.response.data;
    }
    return err.message || "Request failed";
  }
  if (err instanceof Error) return err.message;
  return "Request failed";
}

export const ChatInterface = () => {
  const { user } = useAuth();
  const [isFocused, setIsFocused] = useState(false);
  const [loadingStages, setLoadingStages] = useState<string[]>([]);
  const [attachmentByMessageId, setAttachmentByMessageId] = useState<Record<string, MessageAttachment>>({});
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { addCaseFile } = useCaseFiles();

  const performInvestigationApi = useCallback(async (query: string) => {
    const reportMeta = await apiClient.investigate(query);
    if (!reportMeta?.id) {
      throw new Error("Investigation returned no report ID");
    }
    const report = await apiClient.getReport(reportMeta.id);
    const meta = report as ReportMetadata;
    return {
      id: reportMeta.id,
      name: reportMeta.name ?? reportMeta.id,
      content: meta?.content ?? "",
      geolocations: meta?.geolocations ?? [],
      references: (meta?.sources ?? []) as ReferenceItem[],
    };
  }, []);

  const transport = useCallback<NonNullable<UseChatOptions["transport"]>>(
    async (input: ChatRunInput) => {
      const lastUser = input.messages.filter((m) => m.role === "user").pop();
      const content =
        typeof lastUser?.content === "string" ? lastUser.content.trim() : "";
      if (!content) return [];

      setLoadingStages([
        "Understanding request",
        "Analyzing query context",
        "Generating investigation plan",
        "Accessing data sources",
        "Synthesizing findings",
      ]);

      try {
        if (content.toLowerCase().includes("russell cherry")) {
          setLoadingStages([
            "Understanding request",
            "Searching X accounts",
            "Analyzing account information",
            "Determining strongest match",
          ]);
          await new Promise((r) => setTimeout(r, 6000));
          const id = createMessageId();
          setAttachmentByMessageId((prev) => ({
            ...prev,
            [id]: { isAccountSelector: true },
          }));
          return [{ id, role: "assistant" as const, content: "Russell Cherry X Account Search" }];
        }
        if (content.toLowerCase().includes("roman abramovich")) {
          setLoadingStages([
            "Understanding request",
            "Gathering intelligence data",
            "Analyzing connections and affiliations",
            "Compiling comprehensive report",
          ]);
          await new Promise((r) => setTimeout(r, 6000));
          const id = createMessageId();
          setAttachmentByMessageId((prev) => ({ ...prev, [id]: { isReport: true } }));
          return [{ id, role: "assistant" as const, content: "Roman Abramovich" }];
        }


        const result = await performInvestigationApi(content);
        const id = createMessageId();
        const assistantMsg = {
          id,
          role: "assistant" as const,
          content: result.content.slice(0, 80) || "Investigation complete.",
        };
        setAttachmentByMessageId((prev) => ({
          ...prev,
          [id]: {
            reportContent: result.content,
            geolocations: result.geolocations,
            references: result.references,
            isInvestigationApiReport: true,
          },
        }));
        const caseFileMessages: CaseFile["messages"] = input.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: typeof m.content === "string" ? m.content : "",
          }));
        caseFileMessages.push({
          role: "assistant",
          content: result.name,
        });
        addCaseFile({
          id: Date.now().toString(),
          caseNumber: `INV-${Date.now().toString().slice(-6)}`,
          subject: content.slice(0, 100),
          timestamp: Date.now(),
          category: content.toLowerCase().includes("russell cherry")
            ? "Russell Cherry"
            : content.toLowerCase().includes("roman abramovich")
              ? "Roman Abramovich"
              : content.toLowerCase().includes("iranian petrochemical")
                ? "Iranian Petrochemicals"
                : "Other",
          messages: caseFileMessages,
        });
        toast.success("Investigation saved to case files");
        return [assistantMsg];
      } catch (err: unknown) {
        const message = getInvestigationErrorMessage(err);
        toast.error("Investigation failed: " + message);
        const id = createMessageId();
        return [
          {
            id,
            role: "assistant" as const,
            content: `Investigation failed: ${message}`,
          },
        ];
      } finally {
        setLoadingStages([]);
      }
    },
    [performInvestigationApi, addCaseFile]
  );

  const chat = useChat({ persist: false, transport });
  const { messages, status, error, sendMessage, clearError, reset } = chat;
  const [input, setInput] = useState("");
  const isLoading = status === "loading";

  // Reset chat when navigating back to home
  useEffect(() => {
    if (location.pathname === "/" && location.state?.resetChat) {
      reset();
      setAttachmentByMessageId({});
      setPendingReports([]);
      setInput("");
      setLoadingStages([]);
      navigate("/", { replace: true, state: {} });
    }
  }, [location, navigate, reset]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  // Auto-scroll to bottom when messages or pending reports change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pendingReports.length]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;
      setInput("");
      sendMessage(trimmed);
      // Case file is saved when transport completes (we don't save on account-selector flow here)
    },
    [input, isLoading, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;
        setInput("");
        sendMessage(trimmed);
      }
    },
    [input, isLoading, sendMessage]
  );

  const handleAccountSelection = useCallback(
    async (username: string) => {
      setLoadingStages([
        "Accessing selected account",
        "Analyzing tweet history",
        "Identifying political affiliations",
        "Detecting controversial content",
        "Generating detailed report",
      ]);
      await new Promise((r) => setTimeout(r, 7500));
      setLoadingStages([]);
      const id = createMessageId();
      setPendingReports((prev) => [
        ...prev,
        { id, role: "assistant", content: "Russell Cherry Investigation Report", selectedAccount: username },
      ]);
      const caseFileMessages: CaseFile["messages"] = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : "",
        }));
      caseFileMessages.push({
        role: "assistant",
        content: "Russell Cherry Investigation Report",
        isRussellCherryReport: true,
        selectedAccount: username,
      });
      addCaseFile({
        id: Date.now().toString(),
        caseNumber: "Russell Cherry",
        subject: "Russell Cherry",
        timestamp: Date.now(),
        category: "Russell Cherry",
        messages: caseFileMessages,
      });
      toast.success("Investigation saved to case files");
    },
    [messages, addCaseFile]
  );

  const handleReset = useCallback(() => {
    reset();
    setAttachmentByMessageId({});
    setPendingReports([]);
    setInput("");
    setLoadingStages([]);
    toast.success("Chat cleared");
  }, [reset]);

  const renderMessage = (msg: AgUiMessage) => {
    const attachment = attachmentByMessageId[msg.id];
    if (msg.role === "user") {
      return (
        <div
          key={msg.id}
          className={cn(
            "rounded-lg p-4 bg-card border border-border ml-auto max-w-2xl text-sm text-foreground"
          )}
        >
          <p className="whitespace-pre-wrap">{typeof msg.content === "string" ? msg.content : ""}</p>
        </div>
      );
    }
    if (attachment?.isInvestigationApiReport && attachment.reportContent) {
      return (
        <div
          key={msg.id}
          className="rounded-lg p-4 text-sm max-w-2xl bg-background text-foreground border border-border shadow-sm"
          data-message-id={msg.id}
          data-role="assistant"
        >
          <InvestigationApiReport
            content={attachment.reportContent}
            geolocations={attachment.geolocations}
            references={attachment.references}
          />
        </div>
      );
    }
    if (attachment?.isAccountSelector) {
      return (
        <div key={msg.id} className="rounded-lg p-4 bg-background max-w-2xl">
          <XAccountSelector onConfirm={handleAccountSelection} />
        </div>
      );
    }
    if (attachment?.isReport) {
      return (
        <div key={msg.id} className="rounded-lg p-4 bg-background max-w-2xl">
          <InvestigationReport name={typeof msg.content === "string" ? msg.content : ""} />
        </div>
      );
    }
    return (
      <div key={msg.id} className="max-w-2xl">
        <MessageBubble message={msg} />
      </div>
    );
  };

  const hasMessages = messages.length > 0 || pendingReports.length > 0;

  return (
    <div className="flex flex-col h-full">
      {!hasMessages ? (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-3xl font-semibold text-foreground">Welcome back, {user?.displayName ?? user?.email ?? "Guest"}.</h2>


          </div>
          <form onSubmit={handleSubmit} className="w-full max-w-3xl">
            <div
              className={cn(
                "relative rounded-lg border bg-card transition-all duration-150",
                isFocused ? "border-primary shadow-[0_0_20px_rgba(56,189,248,0.15)]" : "border-border"
              )}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="What would you like to investigate today ?"
                rows={1}
                className={cn(
                  "w-full resize-none bg-transparent px-4 pt-[14px] pb-[14px] pr-12 text-base text-foreground leading-[1.25]",
                  "placeholder:text-muted-foreground/50 focus:outline-none max-h-40 overflow-y-auto"
                )}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                  input.trim() && !isLoading
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground/30 cursor-not-allowed"
                )}
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </form>
          <div className="mt-6 w-full max-w-3xl mx-auto">
            <p className="mb-3 text-xs text-muted-foreground text-center">Suggested examples</p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() =>
                  setInput(
                    "I would like to run an investigation on Roman Abramovich, the details I have on him are he is Russian born in the 1960's."
                  )
                }
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Roman Abramovich
              </button>
              <button
                onClick={() =>
                  setInput(
                    "I am investigating Russell Cherry, help me find his X account, He has worked previously as a councillor. Please analyse his profile with a focus on his political views and affiliations, as well as anything which could be deemed as controversial."
                  )
                }
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Russell Cherry
              </button>
              <button
                onClick={() =>
                  setInput(
                    "Map the current sanctions-evasion ecosystem for Iranian petrochemicals, detailing producer and broker networks and maritime concealment patterns"
                  )
                }
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Iranian Petrochemicals
              </button>
              <button className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80">
                Abbas Araghchi
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-end px-4 py-4 border-b border-border">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto py-8 space-y-6">
            <div className="max-w-4xl mx-auto w-full px-4 space-y-6">
              {messages.map(renderMessage)}
              {pendingReports.map((pr) => (
                <div key={pr.id} className="rounded-lg p-4 bg-background max-w-2xl">
                  <RussellCherryReport username={pr.selectedAccount ?? "russcherry5"} />
                </div>
              ))}
              {isLoading && (
                <div className="rounded-lg border bg-background p-6">
                  <LoadingStages stages={loadingStages} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {error && (
            <div className="flex-shrink-0 px-4 py-2 bg-destructive/10 border-t border-border flex items-center justify-between gap-2">
              <p className="text-sm text-destructive flex-1 min-w-0 truncate">{error}</p>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          )}
          <div className="flex-shrink-0 border-t border-border bg-background py-4">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto w-full px-4">
              <div
                className={cn(
                  "relative rounded-lg border bg-card transition-all duration-150",
                  isFocused ? "border-primary shadow-[0_0_20px_rgba(56,189,248,0.15)]" : "border-border"
                )}
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="What would you like to investigate?"
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent px-4 pt-[14px] pb-[14px] pr-12 text-base text-foreground leading-[1.25]",
                    "placeholder:text-muted-foreground/50 focus:outline-none max-h-40 overflow-y-auto"
                  )}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                    input.trim() && !isLoading
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground px-4">
                Press Enter to send, Shift+Enter for new line.
              </p>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
