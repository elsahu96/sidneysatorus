import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import type { ReferenceItem } from "@/components/InvestigationReferences";
import { SourceGradeBadge } from "@/components/SourceGradeBadge";

const POPOVER_WIDTH = 360;
const POPOVER_HEIGHT = 340; // conservative estimate for flip logic
const GAP = 10;

const FACTOR_LABELS: Record<string, string> = {
  factual_reliability: "Factual",
  source_authority: "Authority",
  bias_objectivity: "Objectivity",
  attribution_quality: "Attribution",
  press_environment: "Press freedom",
  corroboration: "Corroboration",
};

function factorBarColor(score: number): string {
  if (score >= 75) return "#34d399";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}

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

const GRADE_COLORS: Record<string, string> = {
  "A+": "#00c9a7",
  A:   "#10b981",
  "B+": "#3b82f6",
  B:   "#60a5fa",
  C:   "#f59e0b",
  D:   "#ef4444",
};

const GRADE_LABELS: Record<string, string> = {
  "A+": "Highly reliable",
  A:   "Reliable",
  "B+": "Generally reliable",
  B:   "Mostly reliable",
  C:   "Exercise caution",
  D:   "Low reliability",
};

const SIGNAL_COLORS = {
  positive: "#00c9a7",
  negative: "#f87171",
  neutral:  "#94a3b8",
};

const SIGNAL_ICONS = {
  positive: "+",
  negative: "−",
  neutral:  "·",
};

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

    const left = badgeCenterX - POPOVER_WIDTH / 2;
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
  const grade = source.grade;
  const gradeColor = grade ? (GRADE_COLORS[grade] ?? "#94a3b8") : null;
  const gradeLabel = grade ? (GRADE_LABELS[grade] ?? grade) : null;
  const signals = source.analyst_signals ?? [];
  const displayName = source.source_name || null;

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
                padding: "14px 16px 14px",
              }}
            >
              {/* Top row: source name + grade badge + external link */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 3 }}>
                <span
                  style={{
                    color: "#f1f5f9",
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    lineHeight: 1.3,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {displayName ? `@${displayName}` : source.title}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {gradeColor && grade && (
                    <span
                      style={{
                        background: gradeColor,
                        color: "#0f1623",
                        fontWeight: 800,
                        fontSize: "0.75rem",
                        letterSpacing: "0.02em",
                        padding: "2px 8px",
                        borderRadius: 6,
                        lineHeight: 1.6,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {grade}
                    </span>
                  )}
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "#64748b", marginTop: 1 }}
                      className="hover:text-blue-400 transition-colors"
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>

              {/* Date */}
              {date && (
                <div style={{ color: "#64748b", fontSize: "0.73rem", marginBottom: 1 }}>
                  {date}
                </div>
              )}

              {/* Domain */}
              {domain && (
                <div style={{ color: "#64748b", fontSize: "0.73rem", marginBottom: displayName ? 10 : 9 }}>
                  {domain}
                </div>
              )}

              {/* Article title (shown below domain when source_name is the header) */}
              {displayName && source.title && (
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.81rem",
                    lineHeight: 1.5,
                    marginBottom: 10,
                  }}
                >
                  {source.title}
                </div>
              )}

              {/* Key insight (shown when no source_name, as before) */}
              {!displayName && source.key_insight && (
                <div
                  style={{
                    color: "#94a3b8",
                    fontSize: "0.79rem",
                    lineHeight: 1.55,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: "hidden",
                    marginBottom: signals.length > 0 ? 10 : 0,
                  }}
                >
                  {source.key_insight}
                </div>
              )}

              {/* Grading section */}
              {gradeLabel && signals.length > 0 && (
                <>
                  <div
                    style={{
                      height: 1,
                      background: "#2d3244",
                      marginBottom: 10,
                    }}
                  />

                  {/* Grade label */}
                  <div
                    style={{
                      color: "#f1f5f9",
                      fontWeight: 700,
                      fontSize: "0.82rem",
                      marginBottom: 8,
                    }}
                  >
                    {grade} — {gradeLabel}
                  </div>

                  {/* Analyst signals */}
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                    {signals.map((signal, i) => {
                      const sentiment = signal.sentiment ?? "neutral";
                      const color = SIGNAL_COLORS[sentiment] ?? SIGNAL_COLORS.neutral;
                      const icon = SIGNAL_ICONS[sentiment] ?? SIGNAL_ICONS.neutral;
                      return (
                        <li
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 7,
                            color,
                            fontSize: "0.79rem",
                            lineHeight: 1.5,
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "0.85rem",
                              lineHeight: 1.5,
                              flexShrink: 0,
                              width: 10,
                              textAlign: "center",
                            }}
                          >
                            {icon}
                          </span>
                          <span>{signal.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {/* Grade label only (no signals) */}
              {gradeLabel && signals.length === 0 && (
                <>
                  <div style={{ height: 1, background: "#2d3244", marginBottom: 10 }} />
                  <div style={{ color: "#f1f5f9", fontWeight: 700, fontSize: "0.82rem" }}>
                    {grade} — {gradeLabel}
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
