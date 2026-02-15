import { cn } from "@/lib/utils";
import type { Message, UserMessage, InputContent } from "@/types/chat";

/**
 * Get display text from an AG-UI Message (handles user string | InputContent[]).
 */
function getMessageDisplayContent(message: Message): string {
  switch (message.role) {
    case "user": {
      const c = (message as UserMessage).content;
      if (typeof c === "string") return c;
      if (Array.isArray(c))
        return c
          .map((x: InputContent) => (x.type === "text" ? x.text : "[binary]"))
          .join(" ");
      return "";
    }
    case "assistant":
    case "system":
    case "developer":
    case "tool":
      return typeof message.content === "string" ? message.content : "";
    case "activity":
      return `[Activity: ${message.activityType}]`;
    default:
      return "";
  }
}

export interface MessageBubbleProps {
  message: Message;
  className?: string;
}

/**
 * Renders a single AG-UI message with design-system styling.
 * User messages: right-aligned, card border. Assistant/system/tool/activity: left, background/muted.
 */
export function MessageBubble({ message, className }: MessageBubbleProps) {
  const text = getMessageDisplayContent(message);
  const isUser = message.role === "user";
  const isActivity = message.role === "activity";
  const isTool = message.role === "tool";
  const isSystemOrDeveloper =
    message.role === "system" || message.role === "developer";

  return (
    <div
      className={cn(
        "rounded-lg p-4 text-sm",
        isUser &&
        "ml-auto max-w-2xl bg-card border border-border text-foreground",
        message.role === "assistant" &&
        "max-w-2xl bg-background text-foreground",
        isSystemOrDeveloper &&
        "max-w-2xl bg-muted/30 border border-border text-muted-foreground",
        isTool && "max-w-2xl bg-muted/20 border border-border text-muted-foreground font-mono text-xs",
        isActivity &&
        "max-w-md bg-muted/30 border border-border text-muted-foreground",
        className
      )}
      data-message-id={message.id}
      data-role={message.role}
    >
      {message.name && (
        <span className="mb-1 block text-xs font-medium text-muted-foreground">
          {message.name}
        </span>
      )}
      <p className="whitespace-pre-wrap break-words">{text || "—"}</p>
    </div>
  );
}
