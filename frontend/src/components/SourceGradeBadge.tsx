/**
 * Grade badge for source reliability ratings (A+ to D).
 *
 * Renders a compact colour-coded pill. Colour follows the grade tier:
 *   A+ / A  → green        B+ / B → amber/yellow        C / D → red
 */

interface SourceGradeBadgeProps {
  grade: string;
  size?: "sm" | "md";
  className?: string;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "A+": { bg: "#0d3b24", text: "#34d399", border: "#166534" },
  A:    { bg: "#0d3b24", text: "#34d399", border: "#166534" },
  "B+": { bg: "#3b2f08", text: "#fbbf24", border: "#854d0e" },
  B:    { bg: "#3b2f08", text: "#fbbf24", border: "#854d0e" },
  C:    { bg: "#3b1414", text: "#f87171", border: "#991b1b" },
  D:    { bg: "#3b1414", text: "#f87171", border: "#991b1b" },
};

const FALLBACK = { bg: "#1e293b", text: "#94a3b8", border: "#334155" };

export function SourceGradeBadge({ grade, size = "sm", className = "" }: SourceGradeBadgeProps) {
  const colors = GRADE_COLORS[grade] ?? FALLBACK;
  const isSmall = size === "sm";

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: 6,
        fontWeight: 700,
        fontSize: isSmall ? "0.68rem" : "0.78rem",
        lineHeight: 1,
        padding: isSmall ? "2px 6px" : "3px 8px",
        letterSpacing: "0.02em",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {grade}
    </span>
  );
}
