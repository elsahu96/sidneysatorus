import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MessageSquare,
  Clock,
  Archive,
  ChevronRight,
  RefreshCw,
  Plus,
  ArrowLeft,
  FileText,
  Trash2,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { cn } from "@/lib/utils";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { sessionApi } from "@/api/sessionApi";
import { toast } from "sonner";
import type { SessionRecord, SessionMessage } from "@/api/sessionApi";
import ReactMarkdown from "react-markdown";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sessionDisplayTitle(s: SessionRecord): string {
  if (s.title && s.title.trim()) return s.title;
  return `Session ${s.id.slice(-6).toUpperCase()}`;
}

// ── Message bubble (chat-window style) ───────────────────────────────────────

function ChatMessageBubble({ msg }: { msg: SessionMessage }) {
  const isUser = msg.role === "USER";
  const isReport = msg.messageType === "REPORT";
  // Long content = full markdown body (quick search); short = just a title (deep investigate)
  const isFullMarkdown = isReport && msg.content.length > 200;

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">You</span>
        <div className="rounded-lg px-4 py-3 text-sm max-w-2xl bg-card border border-border text-foreground">
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        </div>
        <span className="text-[10px] text-muted-foreground px-1">{formatRelative(msg.createdAt)}</span>
      </div>
    );
  }

  if (isReport && isFullMarkdown) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Sidney</span>
        <div className="rounded-lg p-4 text-sm max-w-2xl w-full bg-background border border-border shadow-sm text-foreground">
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground px-1">{formatRelative(msg.createdAt)}</span>
      </div>
    );
  }

  if (isReport) {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Sidney</span>
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm max-w-2xl w-full shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
              Investigation Report
            </span>
          </div>
          <p className="font-medium text-foreground leading-snug">{msg.content}</p>
          {msg.reportRef && (
            <p className="mt-1.5 text-[11px] text-muted-foreground font-mono truncate opacity-60">
              ref: {msg.reportRef}
            </p>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground px-1">{formatRelative(msg.createdAt)}</span>
      </div>
    );
  }

  // Plain assistant text
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-1">Sidney</span>
      <div className="rounded-lg px-4 py-3 text-sm max-w-2xl bg-background border border-border/60 text-foreground shadow-sm">
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
      </div>
      <span className="text-[10px] text-muted-foreground px-1">{formatRelative(msg.createdAt)}</span>
    </div>
  );
}

// ── Session list item ─────────────────────────────────────────────────────────

function SessionListItem({
  session,
  active,
  onClick,
  onDelete,
}: {
  session: SessionRecord;
  active: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-lg px-3 py-2.5 pr-9 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-accent-foreground",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
          <span className="text-sm font-medium truncate leading-tight">
            {sessionDisplayTitle(session)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 pl-5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">{formatRelative(session.updatedAt)}</span>
          {session.blobPointer && (
            <Archive className="h-3 w-3 text-muted-foreground opacity-60 ml-1" title="Archived" />
          )}
          {session.summary && (
            <span className="text-[11px] text-muted-foreground truncate ml-1 opacity-75">
              · {session.summary}
            </span>
          )}
        </div>
      </button>
      <button
        onClick={onDelete}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        title="Delete session"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="rounded-full bg-muted p-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">No chat history yet</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Start a new investigation to begin a conversation.
        </p>
      </div>
      <button
        onClick={onNewChat}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Plus className="h-4 w-4" />
        New Chat
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SessionHistory() {
  const { isCollapsed } = useSidebarContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { sessions, loading, error, refresh, loadMessages } = useSessionHistory();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSelectSession = useCallback(
    async (id: string) => {
      setActiveId(id);
      setMessages([]);
      setMessagesLoading(true);
      try {
        const msgs = await loadMessages(id);
        setMessages(msgs);
      } catch {
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [loadMessages],
  );

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (!window.confirm("Delete this session? This cannot be undone.")) return;
      setDeletingId(id);
      try {
        await sessionApi.delete(id);
        if (activeId === id) {
          setActiveId(null);
          setMessages([]);
        }
        refresh();
        toast.success("Session deleted");
      } catch (err) {
        toast.error("Failed to delete: " + (err instanceof Error ? err.message : "Unknown error"));
      } finally {
        setDeletingId(null);
      }
    },
    [activeId, refresh],
  );

  // Deep-link: ?id=<sessionId> from sidebar shortcut
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && idParam !== activeId) {
      void handleSelectSession(idParam);
    }
  }, [searchParams, activeId, handleSelectSession]);

  // Select the most recent session by default
  useEffect(() => {
    if (sessions.length > 0 && activeId === null && !searchParams.get("id")) {
      void handleSelectSession(sessions[0].id);
    }
  }, [sessions, activeId, searchParams, handleSelectSession]);

  const activeSession = sessions.find((s) => s.id === activeId) ?? null;

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar />

      <main
        className={cn(
          "flex flex-col flex-1 h-screen overflow-hidden transition-all duration-300",
          isCollapsed ? "ml-16" : "ml-64",
        )}
      >
        {/* Page header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Back to chat"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-foreground">Chat History</h1>
              <p className="text-xs text-muted-foreground">
                {loading ? "Loading…" : `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New Chat
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
            Could not reach the history service. Sessions will appear once the backend is available.
          </div>
        )}

        {/* Body: session list + message viewer */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: session list */}
          <aside className="w-72 shrink-0 border-r border-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
              {loading ? (
                <div className="space-y-2 px-2 py-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <EmptyState onNewChat={() => navigate("/")} />
              ) : (
                sessions.map((s) => (
                  <SessionListItem
                    key={s.id}
                    session={s}
                    active={s.id === activeId}
                    onClick={() => void handleSelectSession(s.id)}
                    onDelete={(e) => void handleDeleteSession(e, s.id)}
                  />
                ))
              )}
            </div>
          </aside>

          {/* Right: message viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {activeId === null && !loading ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <MessageSquare className="h-10 w-10 opacity-30" />
                <p className="text-sm">Select a session to view messages</p>
              </div>
            ) : messagesLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading messages…</span>
                </div>
              </div>
            ) : (
              <>
                {/* Session title bar */}
                {activeSession && (
                  <div className="px-6 py-3 border-b border-border shrink-0">
                    <h2 className="text-sm font-semibold text-foreground truncate">
                      {sessionDisplayTitle(activeSession)}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Started{" "}
                      {new Date(activeSession.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {activeSession.blobPointer && " · Archived"}
                    </p>
                  </div>
                )}

                {/* Messages */}
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                    <MessageSquare className="h-8 w-8 opacity-40" />
                    <p className="text-sm">No messages in this session</p>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto py-8">
                    <div className="max-w-4xl mx-auto w-full px-6 space-y-6">
                      {activeSession?.blobPointer && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2 border border-border">
                          <Archive className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            Showing the last {messages.length} messages. Older messages are archived.
                          </span>
                        </div>
                      )}
                      {messages.map((msg) => (
                        <ChatMessageBubble key={msg.id} msg={msg} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
