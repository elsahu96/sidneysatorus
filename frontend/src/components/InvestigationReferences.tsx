import { Newspaper, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SourceGradeBadge } from "@/components/SourceGradeBadge";

export type ReferenceItem = {
  title: string;
  url: string;
  date: string;
  key_insight: string;
  grade?: string;
  composite_score?: number;
  factor_scores?: {
    factual_reliability: number;
    source_authority: number;
    bias_objectivity: number;
    attribution_quality: number;
    press_environment: number;
    corroboration: number;
  };
  analyst_signals?: Array<{ text: string; sentiment?: string }>;
};

interface InvestigationReferencesProps {
  items: ReferenceItem[];
}

/** Renders the news & sources section from an investigation response. */
export const InvestigationReferences = ({ items }: InvestigationReferencesProps) => {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-primary" />
        News & sources
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i}>
            <Card className="p-4 bg-muted/30 border-border hover:border-primary/50 transition-colors">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 text-foreground hover:text-primary"
              >
                <span className="shrink-0 mt-0.5 min-w-[1.5rem] text-right text-xs font-mono text-muted-foreground">
                  [{i + 1}]
                </span>
                <span className="flex-1 flex items-start gap-2">
                  <ExternalLink className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="flex-1">
                    <span className="font-medium">{item.title}</span>
                    {item.date && (
                      <span className="text-muted-foreground text-sm ml-2">{item.date}</span>
                    )}
                  </span>
                  {item.grade && (
                    <SourceGradeBadge grade={item.grade} size="sm" className="mt-0.5" />
                  )}
                </span>
              </a>
              {item.key_insight && (
                <p className="text-sm text-muted-foreground mt-2 pl-10">{item.key_insight}</p>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
};
