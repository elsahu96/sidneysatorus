import React, { useRef } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Reference } from "@/components/Reference";
import type { ReferenceItem } from "@/components/InvestigationReferences";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";

export interface ReferenceData {
  number: number;
  username: string;
  date: string;
  platform: string;
  content: string;
  link: string;
}

export interface ReportContentProps {
  /** Markdown report content. Inline refs: [1], [2], REF_MARKER_1, or &lt;Reference {...references[0]} /&gt; style placeholders. */
  content: string;
  className?: string;
  enhanced?: boolean;
  /** References rendered inline as &lt;Reference {...references[n]} /&gt; (0-based index n). */
  references?: ReferenceItem[];
}

function toReferenceData(ref: ReferenceItem, index: number): ReferenceData {
  return {
    number: index + 1,
    username: ref.title.split(" ")[0] || "Source",
    date: ref.date || "Unknown",
    platform: ref.url ? new URL(ref.url).hostname.replace("www.", "") : "Unknown",
    content: ref.key_insight || ref.title,
    link: ref.url,
  };
}

/**
 * Renders report content with inline references. Use like:
 * "…screening.<Reference {...references[1]} />" — placeholders in the content
 * are replaced with the Reference component; references[] is 0-based.
 */
export function ReportContent({
  content,
  className,
  enhanced = true,
  references = [],
}: ReportContentProps) {
  const reportRef = useRef<HTMLDivElement>(null);

  if (!content || content.trim() === "") {
    return (
      <div className={cn("text-muted-foreground text-sm italic", className)}>
        No report content available.
      </div>
    );
  }

  // Process content for PDF and display (same normalization)
  const referenceData: ReferenceData[] = references.map(toReferenceData);
  const refByNumber = new Map<number, ReferenceData>();
  referenceData.forEach((r) => refByNumber.set(r.number, r));

  let processedContent = content;
  if (referenceData.length > 0) {
    // Normalize reference placeholders
    processedContent = processedContent.replace(
      /<Reference\s+\{\s*\.\.\.references\[(\d+)\]\s*\}\s*\/>/gi,
      (_, indexStr) => {
        const index = parseInt(indexStr, 10);
        if (index >= 0 && index < referenceData.length) {
          return `__REF_${index + 1}__`;
        }
        return "";
      }
    );
    processedContent = processedContent.replace(/_*REF_MARKER_(\d+)_*/g, (_, num) => {
      const n = parseInt(num, 10);
      return n >= 1 && n <= referenceData.length ? `__REF_${n}__` : `__REF_${n}__`;
    });
    processedContent = processedContent.replace(/\[(\d+)\]/g, (match, num) => {
      const n = parseInt(num, 10);
      if (n >= 1 && n <= referenceData.length) return `__REF_${n}__`;
      return match;
    });
    referenceData.forEach((ref, index) => {
      const escaped = ref.link.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const urlPattern = new RegExp(`\\[([^\\]]+)\\]\\(${escaped}\\)`, "g");
      processedContent = processedContent.replace(urlPattern, () => `__REF_${index + 1}__`);
    });
  }

  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    // Helper to check if we need a new page
    const checkPageBreak = (neededSpace: number = 10): void => {
      if (y + neededSpace > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Helper to add text with word wrapping
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false, lineHeight: number = 6): number => {
      checkPageBreak(lineHeight * 2);
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        checkPageBreak(lineHeight);
        doc.text(line, margin, y);
        y += lineHeight;
      });
      return y;
    };

    // Extract title from content (first h1 or h2)
    const titleMatch = processedContent.match(/^#+\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : "Investigation Report";

    // Add title
    y = addText(title, 18, true, 8);
    y += 3;

    // Add date
    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(dateStr, margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;

    // Process markdown content line by line
    const lines = processedContent.split("\n");
    let inList = false;
    let listIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        y += 3;
        continue;
      }

      // Headings
      if (line.startsWith("# ")) {
        y += 5;
        y = addText(line.substring(2).trim(), 16, true, 7);
        y += 2;
        inList = false;
      } else if (line.startsWith("## ")) {
        y += 4;
        y = addText(line.substring(3).trim(), 14, true, 6);
        y += 2;
        inList = false;
      } else if (line.startsWith("### ")) {
        y += 3;
        y = addText(line.substring(4).trim(), 12, true, 6);
        y += 2;
        inList = false;
      } else if (line.startsWith("#### ")) {
        y += 2;
        y = addText(line.substring(5).trim(), 11, true, 5);
        y += 1;
        inList = false;
      }
      // Unordered lists
      else if (line.startsWith("- ") || line.startsWith("* ")) {
        if (!inList) y += 2;
        inList = true;
        const listText = line.substring(2).trim();
        // Replace reference markers with [n] format
        const textWithRefs = listText.replace(/__REF_(\d+)__/g, (_, num) => {
          const ref = refByNumber.get(parseInt(num, 10));
          return ref ? `[${num}]` : `[${num}]`;
        });
        checkPageBreak(5);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("•", margin, y);
        const lines = doc.splitTextToSize(textWithRefs, maxWidth - 5);
        lines.forEach((l: string, idx: number) => {
          doc.text(l, margin + 5, y + idx * 5);
        });
        y += lines.length * 5;
      }
      // Ordered lists
      else if (/^\d+\.\s/.test(line)) {
        if (!inList) y += 2;
        inList = true;
        const match = line.match(/^\d+\.\s(.+)$/);
        if (match) {
          const listText = match[1].trim();
          const textWithRefs = listText.replace(/__REF_(\d+)__/g, (_, num) => {
            const ref = refByNumber.get(parseInt(num, 10));
            return ref ? `[${num}]` : `[${num}]`;
          });
          checkPageBreak(5);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          const num = line.match(/^(\d+)\./)?.[1] || "";
          doc.text(`${num}.`, margin, y);
          const lines = doc.splitTextToSize(textWithRefs, maxWidth - 8);
          lines.forEach((l: string, idx: number) => {
            doc.text(l, margin + 8, y + idx * 5);
          });
          y += lines.length * 5;
        }
      }
      // Horizontal rule
      else if (line.startsWith("---") || line.startsWith("***")) {
        y += 3;
        checkPageBreak(5);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
        inList = false;
      }
      // Regular paragraph
      else {
        if (inList) {
          y += 2;
          inList = false;
        }
        // Replace reference markers with [n] format
        const textWithRefs = line.replace(/__REF_(\d+)__/g, (_, num) => {
          const ref = refByNumber.get(parseInt(num, 10));
          return ref ? `[${num}]` : `[${num}]`;
        });
        // Remove markdown formatting
        const cleanText = textWithRefs
          .replace(/\*\*(.+?)\*\*/g, "$1") // Bold
          .replace(/\*(.+?)\*/g, "$1") // Italic
          .replace(/`(.+?)`/g, "$1") // Code
          .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1"); // Links
        y = addText(cleanText, 10, false, 6);
      }
    }

    // Add references section at the end
    if (referenceData.length > 0) {
      y += 10;
      checkPageBreak(20);
      y = addText("References", 14, true, 7);
      y += 3;

      referenceData.forEach((ref) => {
        checkPageBreak(15);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(`[${ref.number}]`, margin, y);
        doc.setFont("helvetica", "normal");
        const refText = `${ref.content} — ${ref.platform}, ${ref.date}`;
        const refLines = doc.splitTextToSize(refText, maxWidth - 8);
        refLines.forEach((line: string, idx: number) => {
          doc.text(line, margin + 8, y + idx * 4);
        });
        y += refLines.length * 4 + 2;
      });
    }

    // Generate filename
    const filename = title
      .slice(0, 50)
      .replace(/[^a-z0-9]/gi, "_") + `_${Date.now()}.pdf`;

    doc.save(filename);
  };

  const renderRefOrText = (part: string, key: string): React.ReactNode => {
    const m = part.match(/^__REF_(\d+)__$/);
    if (m) {
      const num = parseInt(m[1], 10);
      const ref = refByNumber.get(num);
      if (ref) return <Reference key={key} {...ref} />;
      return <sup key={key} className="text-muted-foreground">[{num}]</sup>;
    }
    return part;
  };

  const processText = (text: string, keyPrefix: string): React.ReactNode[] => {
    const parts = text.split(/(__REF_\d+__)/g);
    return parts.map((part, i) =>
      part.match(/^__REF_\d+__$/) ? renderRefOrText(part, `${keyPrefix}-${i}`) : part
    );
  };

  const processChildren = (node: React.ReactNode, keyPrefix: string): React.ReactNode => {
    if (typeof node === "string") {
      const arr = processText(node, keyPrefix);
      return arr.length === 1 ? arr[0] : <>{arr.map((el, i) => <React.Fragment key={`${keyPrefix}-${i}`}>{el}</React.Fragment>)}</>;
    }
    if (Array.isArray(node)) {
      return node.map((child, i) => processChildren(child, `${keyPrefix}-${i}`));
    }
    return node;
  };

  if (!enhanced) {
    return (
      <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
        <ReactMarkdown>{processedContent}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div className="absolute top-0 right-0 z-10 mb-4">
        <Button
          onClick={handleDownloadPDF}
          variant="outline"
          size="sm"
          className="gap-2 shadow-sm"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
      </div>
      <div ref={reportRef} className="prose prose-invert max-w-none space-y-8 pt-12">
        <ReactMarkdown
        components={{
          h1: ({ children, ...props }) => (
            <div className="border-b border-border pb-6 mb-6">
              <h1 {...props} className="text-3xl font-bold text-foreground mb-2">
                {children}
              </h1>
            </div>
          ),
          h2: ({ children, ...props }) => (
            <h2 {...props} className="text-2xl font-semibold text-foreground mb-4 mt-8">
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => {
            const isMajor = /^\d+\./.test(String(children).trim());
            return (
              <h3
                {...props}
                className={cn("font-semibold text-foreground mb-3", isMajor ? "text-xl" : "text-lg")}
              >
                {children}
              </h3>
            );
          },
          h4: ({ children, ...props }) => (
            <h4 {...props} className="text-base font-semibold text-foreground mt-4 mb-2">
              {children}
            </h4>
          ),
          p: ({ children, ...props }) => (
            <p {...props} className="text-base text-foreground/90 leading-relaxed mb-3">
              {processChildren(children, "p")}
            </p>
          ),
          // Handle ref markers inside text nodes (e.g. inside strong, em)
          text: ({ children }) => {
            if (typeof children !== "string") return <>{children}</>;
            const arr = processText(children, "t");
            return <>{arr.map((el, i) => <React.Fragment key={`t-${i}`}>{el}</React.Fragment>)}</>;
          },
          ul: ({ children, ...props }) => (
            <ul {...props} className="space-y-2 mb-4 list-disc list-inside text-base text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol {...props} className="space-y-3 mb-4 list-decimal list-inside text-base text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li {...props} className="leading-relaxed">
              {children}
            </li>
          ),
          strong: ({ children, ...props }) => (
            <strong {...props} className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em {...props} className="italic text-foreground/90">
              {children}
            </em>
          ),
          a: ({ children, href, ...props }) => (
            <a
              {...props}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              {children}
            </a>
          ),
          code: ({ children, className: codeClass, ...props }) =>
            codeClass ? (
              <code
                {...props}
                className={cn(
                  "block p-4 rounded-lg bg-card/50 border border-border text-foreground text-sm font-mono overflow-x-auto mb-4",
                  codeClass
                )}
              >
                {children}
              </code>
            ) : (
              <code
                {...props}
                className="px-1.5 py-0.5 rounded bg-muted text-foreground text-sm font-mono"
              >
                {children}
              </code>
            ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              {...props}
              className="border-l-4 border-primary pl-4 py-2 my-4 italic text-foreground/90 bg-card/50 rounded-r"
            >
              {children}
            </blockquote>
          ),
          hr: (props) => <hr {...props} className="my-8 border-border" />,
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table {...props} className="w-full border border-border rounded-lg overflow-hidden">
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => <thead {...props} className="bg-card/80">{children}</thead>,
          tbody: (props) => <tbody {...props} />,
          tr: ({ children, ...props }) => <tr {...props} className="border-b border-border">{children}</tr>,
          th: ({ children, ...props }) => (
            <th
              {...props}
              className="px-4 py-3 text-left text-sm font-semibold text-foreground border-b border-border"
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td {...props} className="px-4 py-3 text-sm text-foreground/90">
              {children}
            </td>
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
      </div>
    </div>
  );
}
