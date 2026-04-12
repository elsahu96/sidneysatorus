import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Plus, Zap, Search } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
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
import { sessionApi } from "@/api/sessionApi";
import { streamQuickSearch } from "@/api/quickSearchApi";
import { useInvestigation } from "@/hooks/useInvestigation";
import type { ReportMetadata, GeolocationItem, ReportSource } from "@/types/index";
import type { ReferenceItem } from "@/components/InvestigationReferences";
import { MessageBubble } from "@/components/MessageBubble";
import { ReportContent } from "@/components/ReportContent";
import { useChat, type UseChatOptions } from "@/hooks/useChat";
import { createMessageId } from "@/services/chatService";
import type { Message as AgUiMessage } from "@/types/chat";
import type { ChatRunInput } from "@/services/chatService";

type SearchMode = "deep" | "quick";


const AGENT_STAGE_POOLS: Record<string, string[]> = {
  "planning-agent": [
    "Structuring analytical findings",
    "Mapping query parameters",
    "Identifying key entities",
    "Generating investigation plan",
    "Preparing search strategy",
    "Ordering findings by significance",
    "Drafting key judgements",
  ],
  "research-agent": [
    "Geocoding identified locations",
    "Plotting AIS position history",
    "Layering port and terminal data",
    "Overlaying sanctions zone perimeters",
    "Tracing cross-border movement patterns",
    "Rendering geographic overlay",
    "Calculating transit corridors",
    "Projecting maritime waypoints",
    "Rendering ship-to-ship transfer zones",
    "Mapping chokepoint proximity",
    "Layering conflict and risk zones",
    "Georeferencing source locations",
    "Assembling geospatial intelligence layer",
    "Mapping jurisdictional boundaries",
    "Pinning key facilities and infrastructure",
    "Plotting entity coordinates",
    "Mapping route trajectories",
    "Projecting overland transit routes",
    "Assembling satellite imagery tiles",
    "Layering customs and port authority zones",
    "Rendering pipeline and energy infrastructure",
    "Mapping diplomatic and consular footprints",
    "Plotting airfield and logistics hubs",
    "Overlaying territorial control boundaries",
    "Calibrating route animation sequences",
  ],
  "asknews-agent": [
    "Geocoding identified locations",
    "Plotting AIS position history",
    "Layering port and terminal data",
    "Overlaying sanctions zone perimeters",
    "Tracing cross-border movement patterns",
    "Assembling geospatial intelligence layer",
    "Mapping jurisdictional boundaries",
    "Rendering final intelligence map",
  ],
  "writer-agent": [
    "Synthesis",
    "Structuring analytical findings",
    "Generating executive summary",
    "Compiling source references",
    "Formatting report output",
    "Synchronising findings",
    "Preparing final assessment",
    "Assembling visual overlays",
    "Drafting key judgements",
    "Writing analytical commentary",
    "Applying confidence ratings to assessments",
    "Generating analyst flags and warnings",
    "Compiling entity reference index",
    "Intelligence report generation",
    "Compiling final intelligence product",
    "Running quality assurance checks",
    "Validating report completeness",
    "Checking citation integrity",
    "Verifying grading consistency",
    "Generating downloadable formats",
    "Delivering intelligence assessment",
  ],
};

interface HitlStateData {
  agent: string;
  description: string;
  threadId: string;
  content_type?: string;
  content?: string;
  sources?: { title: string; url: string; summary: string }[];
  editable?: boolean;
}

/** Inline HITL review card — shown in the chat stream during deep-search investigations. */
const HitlInlineCard = ({
  hitlState,
  hitlEditedContent,
  setHitlEditedContent,
  hitlAdditionalUrls,
  setHitlAdditionalUrls,
  onApprove,
  onReject,
  className = "",
}: {
  hitlState: HitlStateData;
  hitlEditedContent: string;
  setHitlEditedContent: (v: string) => void;
  hitlAdditionalUrls: string;
  setHitlAdditionalUrls: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  className?: string;
}) => (
  <div className={`rounded-lg border bg-card shadow-sm flex flex-col ${className}`}>
    <div className="px-5 pt-4 pb-3 border-b border-border">
      <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-0.5">
        {hitlState.content_type === "plan"
          ? "Review investigation plan"
          : hitlState.content_type === "sources"
            ? "Review research sources"
            : "Confirm report"}
      </p>
      <h3 className="text-sm font-semibold text-foreground">{hitlState.agent}</h3>
    </div>

    <div className="px-5 py-4 space-y-3">
      {hitlState.content_type === "plan" && (
        <>
          <p className="text-xs text-muted-foreground">Review the investigation plan below. You can edit it before research begins.</p>
          <textarea
            className="w-full min-h-[180px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono leading-relaxed"
            value={hitlEditedContent}
            onChange={(e) => setHitlEditedContent(e.target.value)}
          />
        </>
      )}

      {hitlState.content_type === "sources" && (
        <>
          <p className="text-xs text-muted-foreground">
            {hitlState.sources?.length ?? 0} sources found. Add any additional sources below.
          </p>
          {hitlState.sources && hitlState.sources.length > 0 && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {hitlState.sources.map((src, i) => (
                <div key={i} className="rounded-md border border-border bg-background/50 px-3 py-2">
                  <p className="text-xs font-medium text-foreground truncate">{src.title || src.url}</p>
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline truncate block">
                    {src.url}
                  </a>
                  {src.summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{src.summary}</p>}
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Add additional source URLs (one per line):</label>
            <textarea
              className="w-full h-16 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
              placeholder={"https://example.com/article\nhttps://..."}
              value={hitlAdditionalUrls}
              onChange={(e) => setHitlAdditionalUrls(e.target.value)}
            />
          </div>
        </>
      )}

      {hitlState.content_type === "format_confirmation" && hitlState.content && (
        <div className="rounded-md border border-border bg-background/50 px-4 py-3">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{hitlState.content}</pre>
        </div>
      )}
    </div>

    <div className="px-5 py-3 border-t border-border flex gap-2 justify-end">
      <button onClick={onReject} className="px-3 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors">
        Stop
      </button>
      <button onClick={onApprove} className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        {hitlState.content_type === "format_confirmation" ? "Write Report" : "Proceed"}
      </button>
    </div>
  </div>
);

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
  isQuickSearchMarkdown?: boolean;
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
      return `API returned HTML instead of JSON. Check VITE_API_URL (${import.meta.env.VITE_API_URL}) and ensure backend is running.`;
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
  const estimatedSecsRef = useRef(240);

  const [searchMode, setSearchMode] = useState<SearchMode>("deep");
  const modeRef = useRef<SearchMode>("deep");
  const quickAbortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [hitlState, setHitlState] = useState<HitlStateData | null>(null);
  const [hitlEditedContent, setHitlEditedContent] = useState("");
  const [hitlAdditionalUrls, setHitlAdditionalUrls] = useState("");

  const stageCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stagePoolRef = useRef<string[]>([]);
  const stageIndexRef = useRef(0);

  const startStageCycling = useCallback((agent: string) => {
    if (stageCycleRef.current) clearInterval(stageCycleRef.current);
    const pool = AGENT_STAGE_POOLS[agent] ?? AGENT_STAGE_POOLS["research-agent"];
    stagePoolRef.current = pool;
    stageIndexRef.current = 0;
    setLoadingStages([pool[0]]);
    stageCycleRef.current = setInterval(() => {
      stageIndexRef.current = (stageIndexRef.current + 1) % pool.length;
      setLoadingStages([stagePoolRef.current[stageIndexRef.current]]);
    }, 3500);
  }, []);

  const stopStageCycling = useCallback(() => {
    if (stageCycleRef.current) {
      clearInterval(stageCycleRef.current);
      stageCycleRef.current = null;
    }
  }, []);

  useEffect(() => {
    modeRef.current = searchMode;
  }, [searchMode]);

  const navigate = useNavigate();
  const location = useLocation();
  const { addCaseFile } = useCaseFiles();

  const performInvestigationApi = useCallback(async (query: string) => {
    const threadId = crypto.randomUUID();
    activeThreadId.current = threadId;
    const reportMeta = await apiClient.investigate.start(query, { signal: investigateAbortRef.current?.signal });
    activeThreadId.current = null;
    if (!reportMeta?.id) {
      throw new Error("Investigation returned no report ID");
    }
    console.log("ChatInterface: performInvestigationApi: reportMeta:", reportMeta);
    setActiveTaskId(reportMeta.id);

    return new Promise((resolve, reject) => {
      console.log("Initiating SSE stream...");

      const connection = apiClient.investigate.connectStatus(
        reportMeta.id,
        async (data) => {
          console.log("SSE message received:", data);

          if (data.type === "progress") {
            startStageCycling(data.agent);
          }

          if (data.type === "hitl") {
            stopStageCycling();
            setHitlState({
              agent: data.agent,
              description: data.description || "",
              threadId: reportMeta.id,
              content_type: data.content_type,
              content: data.content,
              sources: data.sources,
              editable: data.editable,
            });
            setHitlEditedContent(data.content || "");
            setHitlAdditionalUrls("");
          }

          if (data.type === "completed" || data.status === "completed") {
            stopStageCycling();
            setHitlState(null);
            connection.close();
            try {
              const report = await apiClient.investigate.getReport(data.report_id);
              resolve({
                id: reportMeta.id,
                reportId: data.report_id,
                name: report.name || "Investigation Report",
                content: report.content,
                geolocations: report.geolocations,
                references: report.sources,
              });
            } catch (err) {
              reject(err);
            }
          }

          if (data.type === "error" || data.status === "error") {
            stopStageCycling();
            setHitlState(null);
            connection.close();
            reject(new Error(data.detail || data.message || "Backend process error"));
          }
        },
        (err) => {
          reject(new Error(err.message || "Failed to establish real-time connection to investigation engine."));
        },
      );

      investigateAbortRef.current?.signal?.addEventListener("abort", () => {
        connection.close();
        reject(new Error("Investigation cancelled"));
      });
    });
  }, [startStageCycling, stopStageCycling]);

  const performQuickSearch = useCallback(
    (content: string, sessionId?: string | null): Promise<{ id: string; role: "assistant"; content: string }[]> => {
      return new Promise((resolve) => {
        const assistantMsgId = createMessageId();

        quickAbortRef.current = new AbortController();

        setLoadingStages(["Analysing query…"]);

        streamQuickSearch(
          content,
          (statusText) => {
            setLoadingStages([statusText]);
          },
          (report) => {
            setLoadingStages([]);
            if (report && report.content) {
              setAttachmentByMessageId((prev) => ({
                ...prev,
                [assistantMsgId]: report.references?.length
                  ? {
                      isInvestigationApiReport: true,
                      reportContent: report.content,
                      geolocations: report.geolocations ?? [],
                      references: report.references as unknown as ReferenceItem[],
                    }
                  : { isQuickSearchMarkdown: true, reportContent: report.content },
              }));
              if (sessionId) {
                void sessionApi
                  .appendMessage(sessionId, "ASSISTANT", report.content, "REPORT")
                  .catch(() => {});
              }
              resolve([
                { id: assistantMsgId, role: "assistant" as const, content: "Quick Search Result" },
              ]);
            } else {
              resolve([
                {
                  id: assistantMsgId,
                  role: "assistant" as const,
                  content: "No results returned. Please try rephrasing your query.",
                },
              ]);
            }
            quickAbortRef.current = null;
          },
          (detail) => {
            setLoadingStages([]);
            toast.error("Quick search failed: " + detail);
            resolve([
              {
                id: assistantMsgId,
                role: "assistant" as const,
                content: `Quick search failed: ${detail}`,
              },
            ]);
            quickAbortRef.current = null;
          },
          quickAbortRef.current.signal,
        );
      });
    },
    [],
  );

  const transport = useCallback<NonNullable<UseChatOptions["transport"]>>(
    async (input: ChatRunInput) => {
      const lastUser = input.messages.filter((m) => m.role === "user").pop();
      const content =
        typeof lastUser?.content === "string" ? lastUser.content.trim() : "";
      if (!content) return [];

      // Create a new DB session on first message of a conversation, reuse on follow-ups.
      let sessionId = sessionIdRef.current;
      try {
        if (!sessionId) {
          const session = await sessionApi.create(content.slice(0, 100));
          sessionId = session.id;
          sessionIdRef.current = sessionId;
        }
        void sessionApi.appendMessage(sessionId, "USER", content, "TEXT");
      } catch {
        // Session persistence is best-effort; don't block the investigation.
      }

      if (modeRef.current === "quick") {
        return performQuickSearch(content, sessionId);
      }

      const wordCount = content.split(/\s+/).filter(Boolean).length;
      estimatedSecsRef.current = Math.min(Math.max(180 + wordCount * 12, 120), 480);

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


        const result = await performInvestigationApi(content) as {
          id: string; reportId: string; name: string; content: string;
          geolocations: GeolocationItem[]; references: ReferenceItem[];
        };
        const capturedDuration = elapsedRef.current;
        setReportDuration(capturedDuration);

        const reportMsgId = createMessageId();
        setAttachmentByMessageId((prev) => ({
          ...prev,
          [reportMsgId]: {
            isInvestigationApiReport: true,
            reportContent: result.content,
            geolocations: result.geolocations || [],
            references: result.references || [],
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
          isReport: true,
        });
        addCaseFile({
          id: Date.now().toString(),
          caseNumber: result.reportId || `INV-${Date.now().toString().slice(-6)}`,
          subject: content.slice(0, 100),
          timestamp: Date.now(),
          category: "Other",
          messages: caseFileMessages,
        });
        toast.success("Investigation saved to case files");
        if (sessionId) {
          void sessionApi
            .appendMessage(
              sessionId,
              "ASSISTANT",
              result.name || "Investigation Report",
              "REPORT",
              result.reportId || undefined,
            )
            .catch(() => {});
        }
        return [{ id: reportMsgId, role: "assistant" as const, content: result.name || "Investigation Report" }];
      } catch (err: unknown) {
        if (axios.isCancel(err)) {  
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
        stopStageCycling();
        setHitlState(null);
      }
    },
    [performInvestigationApi, performQuickSearch, addCaseFile, stopStageCycling]
  );

  const handleHitlApprove = useCallback(async () => {
    if (!hitlState) return;
    const decision: { approved: boolean; edited_content?: string; additional_urls?: string[] } = { approved: true };
    if (hitlState.content_type === "plan" && hitlState.editable) {
      decision.edited_content = hitlEditedContent;
    }
    if (hitlState.content_type === "sources") {
      const urls = hitlAdditionalUrls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"));
      if (urls.length > 0) decision.additional_urls = urls;
    }
    try {
      await apiClient.investigate.sendDecision(hitlState.threadId, decision);
    } catch (e) {
      console.error("Failed to send HITL decision:", e);
    }
    setHitlState(null);
    setHitlEditedContent("");
    setHitlAdditionalUrls("");
  }, [hitlState, hitlEditedContent, hitlAdditionalUrls]);

  const handleHitlReject = useCallback(async () => {
    if (!hitlState) return;
    try {
      await apiClient.investigate.sendDecision(hitlState.threadId, { approved: false });
    } catch (e) {
      console.error("Failed to send HITL decision:", e);
    }
    setHitlState(null);
    setHitlEditedContent("");
    setHitlAdditionalUrls("");
  }, [hitlState]);

  const chat = useChat({ persist: false, transport });
  const { messages, status, error, sendMessage, clearError, reset } = chat;
  const [input, setInput] = useState("");
  const isLoading = status === "loading";

  // Progress bar timer
  useEffect(() => {
    if (isLoading) {
      setEstimatedSeconds(estimatedSecsRef.current);
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
      sessionIdRef.current = null;
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
    quickAbortRef.current?.abort();
    sessionIdRef.current = null;
    reset();
    setAttachmentByMessageId({});
    setPendingReports([]);
    setPendingApiReports([]);
    setInput("");
    setLoadingStages([]);
    toast.success("Chat cleared");
  }, [reset]);

  const handleStop = useCallback(() => {
    investigateAbortRef.current?.abort();
    quickAbortRef.current?.abort();
    reset();
    setLoadingStages([]);
    toast.info("Investigation stopped");
  }, [reset]);

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
    if (attachment?.isQuickSearchMarkdown && attachment.reportContent) {
      return (
        <div
          key={msg.id}
          className="rounded-lg p-6 text-sm max-w-2xl bg-background text-foreground border border-border shadow-sm prose prose-sm dark:prose-invert max-w-none"
          data-message-id={msg.id}
          data-role="assistant"
        >
          <ReactMarkdown>{attachment.reportContent}</ReactMarkdown>
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
          {isLoading && (
            hitlState
              ? <HitlInlineCard hitlState={hitlState} hitlEditedContent={hitlEditedContent} setHitlEditedContent={setHitlEditedContent} hitlAdditionalUrls={hitlAdditionalUrls} setHitlAdditionalUrls={setHitlAdditionalUrls} onApprove={handleHitlApprove} onReject={handleHitlReject} className="w-full max-w-3xl mb-6" />
              : estimatedSeconds > 0
                ? (() => {
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
                          <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground text-right">
                          Estimated time remaining: {mins}m {secs.toString().padStart(2, "0")}s
                        </p>
                      </div>
                    );
                  })()
                : null
          )}
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
            <div className="flex items-center gap-1 mt-2 px-1">
              <button
                type="button"
                onClick={() => setSearchMode("deep")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  searchMode === "deep"
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Search className="h-3.5 w-3.5" />
                Deep Research
              </button>
              <button
                type="button"
                onClick={() => setSearchMode("quick")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  searchMode === "quick"
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                Quick Search
              </button>
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
              {isLoading && (
                hitlState
                  ? <HitlInlineCard hitlState={hitlState} hitlEditedContent={hitlEditedContent} setHitlEditedContent={setHitlEditedContent} hitlAdditionalUrls={hitlAdditionalUrls} setHitlAdditionalUrls={setHitlAdditionalUrls} onApprove={handleHitlApprove} onReject={handleHitlReject} />
                  : estimatedSeconds > 0
                    ? (() => {
                        const pct = Math.min(Math.round((elapsedSeconds / estimatedSeconds) * 100), 95);
                        const remaining = Math.max(estimatedSeconds - elapsedSeconds, 0);
                        const mins = Math.floor(remaining / 60);
                        const secs = remaining % 60;
                        return (
                          <div className="rounded-lg border bg-background p-6 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <LoadingStages stages={loadingStages.length > 0 ? loadingStages : ["Analysing intelligence sources…"]} />
                              <span className="font-mono font-medium text-foreground">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-xs text-muted-foreground text-right">
                              Estimated time remaining: {mins}m {secs.toString().padStart(2, "0")}s
                            </p>
                          </div>
                        );
                      })()
                    : null
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
                {isLoading ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="absolute right-3 bottom-3 rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-all duration-150"
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
              <div className="flex items-center gap-1 mt-2 px-1">
                <button
                  type="button"
                  onClick={() => setSearchMode("deep")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    searchMode === "deep"
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Search className="h-3.5 w-3.5" />
                  Deep Research
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("quick")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    searchMode === "quick"
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Quick Search
                </button>
                <span className="ml-auto text-xs text-muted-foreground">
                  Press Enter to send, Shift+Enter for new line.
                </span>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
