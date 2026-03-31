import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Plus } from "lucide-react";
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
import { apiClient } from "@/api/api";
import { useInvestigation } from "@/hooks/useInvestigation";
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
  duration?: number;
}

/** Pending report from the real investigation API — shown immediately on API return */
interface PendingApiReport {
  id: string;
  content: string;
  geolocations: GeolocationItem[];
  references: ReferenceItem[];
  duration: number;
}

function isRequestCancelled(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  return err.code === "ERR_CANCELED";
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
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [loadingStages, setLoadingStages] = useState<string[]>([]);
  const [attachmentByMessageId, setAttachmentByMessageId] = useState<Record<string, MessageAttachment>>({});
  const [pendingReports, setPendingReports] = useState<PendingReport[]>([]);
  const [pendingApiReports, setPendingApiReports] = useState<PendingApiReport[]>([]);
  const [estimatedSeconds, setEstimatedSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reportDuration, setReportDuration] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const activeThreadId = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const investigateAbortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { addCaseFile } = useCaseFiles();

  const performInvestigationApi = useCallback(async (query: string, signal?: AbortSignal) => {
    const reportMeta = await apiClient.investigate.start(query, { signal });
    if (!reportMeta?.id) {
      throw new Error("Investigation returned no report ID");
    }
    console.log("ChatInterface: performInvestigationApi: reportMeta:", reportMeta);
    setActiveTaskId(reportMeta.id);
    // 2. Use Promise to wrap the WebSocket waiting process
    return new Promise((resolve, reject) => {
      console.log("Initiating WebSocket connection...");

      const socket = apiClient.investigate.connectStatus(reportMeta.id, async (data) => {
        console.log("WS Message received:", data);

        if (data.status === "completed") {
          socket.close();
          try {
            const report = await apiClient.investigate.getReport(data.report_id);
            resolve({
              id: reportMeta.id,
              name: report.name || "Investigation Report",
              content: report.content,
              geolocations: report.geolocations,
              references: report.sources,
            });
          } catch (err) {
            reject(err);
          }
        }

        if (data.status === "error") {
          socket.close();
          reject(new Error(data.message || "Backend process error"));
        }
      });

      // Handle WebSocket connection failure
      socket.onerror = (err) => {
        console.error("WebSocket failed to connect:", err);
        reject(new Error("Failed to establish real-time connection to investigation engine."));
      };

      // Handle user cancellation
      signal?.addEventListener("abort", () => {
        socket.close();
        reject(new Error("Investigation cancelled"));
      });
    });
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

        investigateAbortRef.current?.abort();
        investigateAbortRef.current = new AbortController();
        const result = await performInvestigationApi(content, investigateAbortRef.current.signal);
        const capturedDuration = elapsedRef.current;

        // Show the report immediately — don't wait for transport to finish
        setReportDuration(capturedDuration);
        setEstimatedSeconds(0);
        setLoadingStages([]);
        setPendingApiReports((prev) => [
          ...prev,
          {
            id: createMessageId(),
            content: result.content,
            geolocations: result.geolocations,
            references: result.references,
            duration: capturedDuration,
          },
        ]);

        // Save to case files in the background (non-blocking for the user)
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
        return [];
      } catch (err: unknown) {
        if (isRequestCancelled(err)) {
          const id = createMessageId();
          return [
            {
              id,
              role: "assistant" as const,
              content: "Investigation cancelled.",
            },
          ];
        }
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
        investigateAbortRef.current = null;
        setActiveTaskId(null);
        setLoadingStages([]);
      }
    },
    [performInvestigationApi, addCaseFile]
  );

  const chat = useChat({ persist: false, transport });
  const { messages, status, error, sendMessage, clearError, reset } = chat;
  const [input, setInput] = useState("");
  const isLoading = status === "loading";

  const handleCancelInvestigation = useCallback(async () => {
    investigateAbortRef.current?.abort();

    if (activeTaskId) {
      try {
        await apiClient.investigate.terminate(activeTaskId);
        toast.success("Investigation process terminated.");
      } catch (err) {
        console.error("Backend termination failed:", err);
      } finally {
        setActiveTaskId(null);
        setLoadingStages([]);
      }
    }
  }, [activeTaskId]);

  // Progress bar timer
  useEffect(() => {
    if (isLoading) {
      const secs = Math.floor(Math.random() * (7 - 4 + 1) + 4) * 60; // 4–7 min in seconds
      setEstimatedSeconds(secs);
      setElapsedSeconds(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (elapsedRef.current > 0) {
        setReportDuration(elapsedRef.current);
      }
      elapsedRef.current = 0;
      setElapsedSeconds(0);
      setEstimatedSeconds(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading]);

  // Reset chat when navigating back to home
  useEffect(() => {
    if (location.pathname === "/" && location.state?.resetChat) {
      reset();
      setAttachmentByMessageId({});
      setPendingReports([]);
      setPendingApiReports([]);
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
      const accountSelectionStart = Date.now();
      await new Promise((r) => setTimeout(r, 7500));
      const accountSelectionDuration = Math.round((Date.now() - accountSelectionStart) / 1000);
      setLoadingStages([]);
      const id = createMessageId();

      const caseFileMessages: CaseFile["messages"] = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : "",
        }));

      toast.success("Investigation saved to case files");
    },
    [messages, addCaseFile]
  );

  const handleReset = useCallback(() => {
    reset();
    setAttachmentByMessageId({});
    setPendingReports([]);
    setPendingApiReports([]);
    setInput("");
    setLoadingStages([]);
    toast.success("Chat cleared");
  }, [reset]);

  const handleStop = useCallback(() => {
    handleCancelInvestigation();
    reset();
    setLoadingStages([]);
    toast.info("Investigation stopped");
  }, [handleCancelInvestigation, reset]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins} min ${secs} sec`;
    return `${secs} sec`;
  };

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
          {reportDuration != null && (
            <p className="mt-4 text-xs text-muted-foreground text-right">Analysis completed in {formatDuration(reportDuration)}</p>
          )}
        </div>
      );
    }
    // if (attachment?.isAccountSelector) {
    //   return (
    //     <div key={msg.id} className="rounded-lg p-4 bg-background max-w-2xl">
    //       <XAccountSelector onConfirm={handleAccountSelection} />
    //     </div>
    //   );
    // }
    if (attachment?.isReport) {
      return (
        <div key={msg.id} className="rounded-lg p-4 bg-background max-w-2xl">
          <InvestigationReport name={typeof msg.content === "string" ? msg.content : ""} />
          {reportDuration != null && (
            <p className="mt-4 text-xs text-muted-foreground text-right">Analysis completed in {formatDuration(reportDuration)}</p>
          )}
        </div>
      );
    }
    return (
      <div key={msg.id} className="max-w-2xl">
        <MessageBubble message={msg} />
      </div>
    );
  };

  const hasMessages = messages.length > 0 || pendingReports.length > 0 || pendingApiReports.length > 0;

  return (
    <div className="flex flex-col h-full">
      {!hasMessages ? (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          {isLoading && estimatedSeconds > 0 && (() => {
            const pct = Math.min(Math.round((elapsedSeconds / estimatedSeconds) * 100), 95);
            const remaining = Math.max(estimatedSeconds - elapsedSeconds, 0);
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;
            return (
              <div className="w-full max-w-3xl mb-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <LoadingStages stages={loadingStages.length > 0 ? loadingStages : ["Analysing intelligence sources…"]} />
                  <span className="font-mono font-medium text-foreground">{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  Estimated time remaining: {mins}m {secs.toString().padStart(2, "0")}s
                </p>
              </div>
            );
          })()}
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
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="absolute right-3 bottom-3 rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-all duration-150"
                  aria-label="Cancel investigation"
                  title="Stop investigation"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className={cn(
                    "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                    input.trim() ? "text-primary hover:bg-primary/10" : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  <Send className="h-5 w-5" />
                </button>
              )}
            </div>
          </form>
          <div className="mt-6 w-full max-w-3xl mx-auto">
            <p className="mb-3 text-xs text-muted-foreground text-center">Suggested examples</p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() =>
                  setInput(
                    "I am advising a pro-Islam NGO establishing operations in the United Kingdom. Assess environments where the organisation may encounter hostility, counter-protests, or other kinds of violence. "
                  )
                }
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                NGO environment analysis
              </button>
              <button
                onClick={() =>
                  setInput(
                    "Map current zones of instability along the Pakistan-Afghanistan border. Break down by sub-region"
                  )
                }
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Pakistan-Afghanistan border instability
              </button>
              <button
                onClick={() =>
                  setInput(
                    "Assess risks to a civilian or analytical team operating in Cyprus following the recent Iranian attack on the British military base. Break down by sub-region"
                  )
                }
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                UK military base attack risks
              </button>
              <button
                onClick={() =>
                  setInput(
                    "I run a Berlin-based company that depends on energy and materials shipped through the Strait of Hormuz. how might the current conflict involving Iran impact my operations? "
                  )
                }
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Strait of Hormuz impact
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
                  {pr.duration != null && (
                    <p className="mt-4 text-xs text-muted-foreground text-right">Analysis completed in {formatDuration(pr.duration)}</p>
                  )}
                </div>
              ))}
              {pendingApiReports.map((pr) => (
                <div key={pr.id} className="rounded-lg p-4 text-sm max-w-2xl bg-background text-foreground border border-border shadow-sm">
                  <InvestigationApiReport
                    content={pr.content}
                    geolocations={pr.geolocations}
                    references={pr.references}
                  />
                  <p className="mt-4 text-xs text-muted-foreground text-right">Analysis completed in {formatDuration(pr.duration)}</p>
                </div>
              ))}
              {isLoading && estimatedSeconds > 0 && (() => {
                const pct = Math.min(Math.round((elapsedSeconds / estimatedSeconds) * 100), 95);
                const remaining = Math.max(estimatedSeconds - elapsedSeconds, 0);
                const mins = Math.floor(remaining / 60);
                const secs = remaining % 60;
                return (
                  <div className="rounded-lg border bg-background p-6 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <LoadingStages stages={loadingStages.length > 0 ? loadingStages : ["Analysing intelligence sources…"]} />
                        <span className="font-mono font-medium text-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground text-right">
                        Estimated time remaining: {mins}m {secs.toString().padStart(2, "0")}s
                      </p>
                    </div>
                  </div>
                );
              })()}
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
                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="absolute right-3 bottom-3 rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-all duration-150"
                    aria-label="Cancel investigation"
                    title="Stop investigation"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className={cn(
                      "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                      input.trim() ? "text-primary hover:bg-primary/10" : "text-muted-foreground/30 cursor-not-allowed"
                    )}
                  >
                    <Send className="h-5 w-5" />
                  </button>
                )}
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
