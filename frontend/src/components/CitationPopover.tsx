import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import type { ReferenceItem } from "@/components/InvestigationReferences";

const POPOVER_WIDTH = 300;
const POPOVER_HEIGHT = 160; // conservative estimate for flip logic
const GAP = 10;

interface PopoverPos {
  top: number;
  left: number;
  caretLeft: number;
  below: boolean;
}

interface CitationPopoverProps {
  num: number;
  source: ReferenceItem;
}

function formatDate(raw: string): string {
  try {
    return new Date(raw).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return raw;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** A single inline citation badge [n] that shows a floating source card on hover. */
export function CitationPopover({ num, source }: CitationPopoverProps) {
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const badgeRef = useRef<HTMLElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (!badgeRef.current) return;

    const rect = badgeRef.current.getBoundingClientRect();
    const badgeCenterX = rect.left + rect.width / 2;

    const below = rect.top < POPOVER_HEIGHT + GAP + 24;
    const top = below ? rect.bottom + GAP : rect.top - POPOVER_HEIGHT - GAP;

    let left = badgeCenterX - POPOVER_WIDTH / 2;
    const clampedLeft = Math.max(10, Math.min(left, window.innerWidth - POPOVER_WIDTH - 10));
    const caretLeft = Math.max(14, Math.min(badgeCenterX - clampedLeft, POPOVER_WIDTH - 14));

    setPos({ top, left: clampedLeft, below, caretLeft });
  }, []);

  const scheduleHide = useCallback(() => {
    leaveTimer.current = setTimeout(() => setPos(null), 120);
  }, []);

  const cancelHide = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const domain = source.url ? getDomain(source.url) : "";
  const date = source.date ? formatDate(source.date) : "";

  return (
    <>
      <sup
        ref={badgeRef}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        style={{
          color: "#60a5fa",
          fontWeight: 600,
          fontSize: "0.72em",
          letterSpacing: "0.01em",
          cursor: "pointer",
          userSelect: "none",
          verticalAlign: "super",
          lineHeight: 0,
          padding: "0 1px",
          transition: "filter 100ms",
        }}
        onMouseDown={(e) => e.preventDefault()}
        className="hover:brightness-125"
      >
        [{num}]
      </sup>

      {pos &&
        createPortal(
          <div
            onMouseEnter={cancelHide}
            onMouseLeave={scheduleHide}
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: POPOVER_WIDTH,
              zIndex: 9999,
              pointerEvents: "auto",
            }}
          >
            {/* Caret */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                ...(pos.below
                  ? { top: -6, borderBottom: "1px solid #2d3244", borderRight: "1px solid #2d3244" }
                  : { bottom: -6, borderTop: "1px solid #2d3244", borderLeft: "1px solid #2d3244" }),
                left: pos.caretLeft,
                transform: `translateX(-50%) rotate(${pos.below ? "225deg" : "45deg"})`,
                width: 11,
                height: 11,
                background: "#1c1f2e",
              }}
            />

            {/* Card */}
            <div
              style={{
                background: "#1c1f2e",
                border: "1px solid #2d3244",
                borderRadius: 10,
                boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)",
                overflow: "hidden",
                padding: "13px 15px 12px",
              }}
            >
              {/* Title row */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    color: "#f1f5f9",
                    fontWeight: 700,
                    fontSize: "0.84rem",
                    lineHeight: 1.35,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {source.title}
                </span>
                {source.url && (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: "#64748b", flexShrink: 0, marginTop: 1 }}
                    className="hover:text-blue-400 transition-colors"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>

              {/* Date */}
              {date && (
                <div style={{ color: "#64748b", fontSize: "0.73rem", marginBottom: 1 }}>
                  {date}
                </div>
              )}

              {/* Domain */}
              {domain && (
                <div style={{ color: "#64748b", fontSize: "0.73rem", marginBottom: 9 }}>
                  {domain}
                </div>
              )}

              {/* Key insight */}
              {source.key_insight && (
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.79rem",
                    lineHeight: 1.55,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                  }}
                >
                  {source.key_insight}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
