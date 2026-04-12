import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getReportData } from "@/lib/reportData";
import type { ReportSection } from "@/lib/reportData";

interface InvestigationReportProps {
  name: string;
}

// CSS classes per section style
const sectionStyles: Record<string, string> = {
  highlight: "bg-[hsl(var(--info-bg))] border-[hsl(var(--info-border))]",
  warning: "bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))]",
  normal: "bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]",
};

function sectionCardClass(style?: ReportSection["style"]) {
  return sectionStyles[style ?? "normal"] ?? sectionStyles.normal;
}

function SectionIcon({ style }: { style?: ReportSection["style"] }) {
  if (style === "warning") return <AlertCircle className="h-5 w-5 text-[hsl(var(--warning-text))]" />;
  if (style === "highlight") return <Shield className="h-5 w-5 text-primary" />;
  return null;
}

function SectionContent({ content }: { content: string }) {
  // Split on double newlines for paragraph blocks; single newlines become line breaks
  const blocks = content.split(/\n\n+/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        return (
          <p key={i} className="text-[hsl(var(--report-text))] leading-relaxed text-base mb-3 last:mb-0">
            {lines.map((line, j) => (
              <span key={j}>
                {line}
                {j < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </>
  );
}

export const InvestigationReport = ({ name }: InvestigationReportProps) => {
  const report = getReportData(name);

  if (!report) {
    return (
      <div className="space-y-6">
        <div className="border-b border-[hsl(var(--report-border))] pb-6">
          <h2 className="text-3xl font-bold text-foreground mb-4">{name}</h2>
        </div>
        <p className="text-muted-foreground text-sm">No structured report data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[hsl(var(--report-border))] pb-6">
        <h2 className="text-3xl font-bold text-foreground mb-4">{report.subject}</h2>
        <div className="flex items-center gap-3">
          <Badge className="gap-1.5 bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))] text-[hsl(var(--warning-text))] hover:bg-[hsl(var(--warning-bg))]">
            <AlertCircle className="h-3.5 w-3.5" />
            High Risk
          </Badge>
          <Badge variant="outline" className="bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">PEP</Badge>
          <Badge variant="outline" className="bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">Sanctioned</Badge>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-5">
        {report.sections.map((section, i) => (
          <Card key={i} className={cn("p-6", sectionCardClass(section.style))}>
            <h4
              className={cn(
                "font-semibold text-foreground mb-4 flex items-center gap-2",
                i === 0 ? "text-xl" : "text-lg",
              )}
            >
              <SectionIcon style={section.style} />
              {section.title}
            </h4>
            <SectionContent content={section.content} />
            {section.subsections && section.subsections.length > 0 && (
              <div className="mt-4 space-y-4">
                {section.subsections.map((sub, j) => (
                  <div key={j}>
                    <h5 className="text-sm font-semibold text-foreground mb-2">{sub.title}</h5>
                    <SectionContent content={sub.content} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};
