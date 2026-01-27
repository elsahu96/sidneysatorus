import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

interface GlossaryTermProps {
  term: string;
  definition: string;
}

export const GlossaryTerm = ({ term, definition }: GlossaryTermProps) => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span className="font-semibold cursor-help border-b border-dotted border-[hsl(var(--report-text))]">
          {term}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <p className="text-sm text-muted-foreground leading-relaxed">{definition}</p>
      </HoverCardContent>
    </HoverCard>
  );
};
