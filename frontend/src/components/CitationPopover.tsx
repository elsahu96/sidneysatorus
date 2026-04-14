import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";
import type { ReferenceItem } from "@/components/InvestigationReferences";
import { SourceGradeBadge } from "@/components/SourceGradeBadge";

const POPOVER_WIDTH = 320;
const POPOVER_HEIGHT = 380; // increased for grading content
const GAP = 10;

const GRADE_LABELS: Record<string, string> = {
  "A+": "Highly reliable",
  A: "Reliable",
  "B+": "Generally reliable",
  B: "Mostly reliable",
  C: "Use with caution",
  D: "Unreliable",
};

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

const SIGNAL_COLORS: Record<string, string> = {
  "+": "#34d399",
  "-": "#f87171",
  "neutral": "#94a3b8",
};

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

              {/* Grading section */}
              {source.grade && (
                <>
                  {/* Divider */}
                  <div
                    style={{
                      borderTop: "1px solid #2d3244",
                      margin: "10px 0 8px",
                    }}
                  />

                  {/* Grade header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <SourceGradeBadge grade={source.grade} size="md" />
                    <span
                      style={{
                        color: "#cbd5e1",
                        fontSize: "0.78rem",
                        fontWeight: 600,
                      }}
                    >
                      {GRADE_LABELS[source.grade] ?? ""}
                    </span>
                    {source.composite_score != null && (
                      <span
                        style={{
                          color: "#64748b",
                          fontSize: "0.7rem",
                          marginLeft: "auto",
                        }}
                      >
                        {source.composite_score}/100
                      </span>
                    )}
                  </div>

                  {/* Factor bars */}
                  {source.factor_scores && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
                      {Object.entries(FACTOR_LABELS).map(([key, label]) => {
                        const score = (source.factor_scores as Record<string, number>)?.[key];
                        if (score == null) return null;
                        return (
                          <div
                            key={key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                color: "#94a3b8",
                                fontSize: "0.65rem",
                                width: 72,
                                flexShrink: 0,
                                textAlign: "right",
                              }}
                            >
                              {label}
                            </span>
                            <div
                              style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 2,
                                background: "#1e293b",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${score}%`,
                                  height: "100%",
                                  borderRadius: 2,
                                  background: factorBarColor(score),
                                  transition: "width 300ms ease",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                color: "#64748b",
                                fontSize: "0.6rem",
                                width: 22,
                                textAlign: "right",
                                flexShrink: 0,
                              }}
                            >
                              {score}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Analyst signals */}
                  {source.analyst_signals && source.analyst_signals.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {source.analyst_signals.map((sig, idx) => {
                        const signal = typeof sig === "string" ? { text: sig, sentiment: "neutral" } : sig;
                        const sentimentKey = signal.sentiment ?? "neutral";
                        const color = SIGNAL_COLORS[sentimentKey] ?? SIGNAL_COLORS["neutral"];
                        const icon = sentimentKey === "+" ? "+" : sentimentKey === "-" ? "−" : "•";
                        return (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 6,
                              fontSize: "0.72rem",
                              lineHeight: 1.45,
                            }}
                          >
                            <span
                              style={{
                                color,
                                fontWeight: 700,
                                flexShrink: 0,
                                width: 12,
                                textAlign: "center",
                              }}
                            >
                              {icon}
                            </span>
                            <span style={{ color: "#94a3b8" }}>{signal.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
