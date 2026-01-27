import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ExternalLink } from "lucide-react";

interface ReferenceProps {
  number: number;
  username: string;
  date: string;
  platform: string;
  content: string;
  link: string;
}

export const Reference = ({ number, username, date, platform, content, link }: ReferenceProps) => {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 transition-colors cursor-pointer mx-0.5 align-super"
          onClick={(e) => e.stopPropagation()}
        >
          {number}
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">@{username}</p>
              <p className="text-xs text-muted-foreground">{date}</p>
              <p className="text-xs text-muted-foreground">{platform}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
