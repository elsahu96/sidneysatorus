import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Home, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { InvestigationReport } from "@/components/InvestigationReport";
import { XAccountSelector } from "@/components/XAccountSelector";
import { RussellCherryReport } from "@/components/RussellCherryReport";
import { IranianPetrochemicalsReport } from "@/components/IranianPetrochemicalsReport";
import { LoadingStages } from "@/components/LoadingStages";
import { useCaseFiles } from "@/contexts/CaseFilesContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  isReport?: boolean;
  isAccountSelector?: boolean;
  isRussellCherryReport?: boolean;
  isIranianPetrochemicalsReport?: boolean;
  selectedAccount?: string;
}

export const ChatInterface = () => {
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStages, setLoadingStages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { addCaseFile } = useCaseFiles();

  // Reset chat when navigating back to home
  useEffect(() => {
    if (location.pathname === "/" && location.state?.resetChat) {
      setMessages([]);
      setInput("");
      setIsLoading(false);
      setLoadingStages([]);
      // Clear the state
      navigate("/", { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  const mockInvestigation = async (query: string): Promise<Message> => {
    // Check if query mentions Russell Cherry
    if (query.toLowerCase().includes("russell cherry")) {
      setLoadingStages([
        "Understanding request",
        "Searching X accounts",
        "Analyzing account information",
        "Determining strongest match"
      ]);
      await new Promise(resolve => setTimeout(resolve, 6000)); // 4 stages * 1.5 seconds
      setLoadingStages([]);
      return {
        role: "assistant",
        content: "Russell Cherry X Account Search",
        isAccountSelector: true
      };
    }

    // Check if query mentions Roman Abramovich
    if (query.toLowerCase().includes("roman abramovich")) {
      setLoadingStages([
        "Understanding request",
        "Gathering intelligence data",
        "Analyzing connections and affiliations",
        "Compiling comprehensive report"
      ]);
      await new Promise(resolve => setTimeout(resolve, 6000)); // 4 stages * 1.5 seconds
      setLoadingStages([]);
      return {
        role: "assistant",
        content: "Roman Abramovich",
        isReport: true
      };
    }

    // Check if query mentions Iranian petrochemicals
    if (query.toLowerCase().includes("iranian petrochemical")) {
      setLoadingStages([
        "Understanding request",
        "Analyzing sanctions data",
        "Mapping broker networks",
        "Identifying maritime patterns",
        "Compiling comprehensive report"
      ]);
      await new Promise(resolve => setTimeout(resolve, 7500)); // 5 stages * 1.5 seconds
      setLoadingStages([]);
      return {
        role: "assistant",
        content: "Iranian Petrochemicals Sanctions-Evasion Network",
        isIranianPetrochemicalsReport: true
      };
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      role: "assistant",
      content: "Investigation complete. No significant findings at this time.",
      isReport: false
    };
  };

  const handleAccountSelection = async (username: string) => {
    setIsLoading(true);
    setLoadingStages([
      "Accessing selected account",
      "Analyzing tweet history",
      "Identifying political affiliations",
      "Detecting controversial content",
      "Generating detailed report"
    ]);
    await new Promise(resolve => setTimeout(resolve, 7500)); // 5 stages * 1.5 seconds
    setLoadingStages([]);

    const reportMessage: Message = {
      role: "assistant",
      content: "Russell Cherry Investigation Report",
      isRussellCherryReport: true,
      selectedAccount: username
    };

    const updatedMessages = [...messages, reportMessage];
    setMessages(updatedMessages);
    setIsLoading(false);

    // Save to case files
    const subject = "Russell Cherry";
    const caseFile = {
      id: Date.now().toString(),
      caseNumber: subject,
      subject: subject,
      timestamp: Date.now(),
      category: "Russell Cherry" as const,
      messages: updatedMessages
    };
    addCaseFile(caseFile);
    toast.success("Investigation saved to case files");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await mockInvestigation(input);
      const updatedMessages = [...messages, userMessage, response];
      setMessages(prev => [...prev, response]);

      // Only save to case files for completed investigations (not account selectors)
      if (!response.isAccountSelector) {
        // Extract subject name from response content
        const subject = response.content;

        // Determine category based on subject
        let category: "Russell Cherry" | "Roman Abramovich" | "Iranian Petrochemicals" | "Other" = "Other";
        if (subject.toLowerCase().includes("russell cherry")) {
          category = "Russell Cherry";
        } else if (subject.toLowerCase().includes("roman abramovich")) {
          category = "Roman Abramovich";
        } else if (subject.toLowerCase().includes("iranian petrochemicals")) {
          category = "Iranian Petrochemicals";
        }

        const caseFile = {
          id: Date.now().toString(),
          caseNumber: subject,
          subject: subject,
          timestamp: Date.now(),
          category,
          messages: updatedMessages
        };
        addCaseFile(caseFile);
        toast.success("Investigation saved to case files");
      }
    } catch (error) {
      console.error("Investigation error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    setLoadingStages([]);
    toast.success("Chat cleared");
  };

  return (
    <div className="flex flex-col h-full">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 px-4">
          {/* Welcome Message */}
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-3xl font-semibold text-foreground">
              Welcome back, Harry.
            </h2>
            <p className="text-sm text-muted-foreground">
              What would you like to investigate today?
            </p>
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-3xl">
            <div className={cn(
              "relative rounded-lg border bg-card transition-all duration-150",
              isFocused ? "border-primary shadow-[0_0_20px_rgba(56,189,248,0.15)]" : "border-border"
            )}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="What would you like to investigate?"
                rows={1}
                className={cn(
                  "w-full resize-none bg-transparent px-4 pt-[14px] pb-[14px] pr-12 text-base text-foreground leading-[1.25]",
                  "placeholder:text-muted-foreground/50",
                  "focus:outline-none max-h-40 overflow-y-auto"
                )}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                  input.trim() && !isLoading
                    ? "text-primary hover:bg-primary/10"
                    : "text-muted-foreground/30 cursor-not-allowed"
                )}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>

          {/* Suggested Prompts */}
          <div className="mt-6 w-full max-w-3xl mx-auto">
            <p className="mb-3 text-xs text-muted-foreground text-center">Suggested examples</p>
            <div className="flex gap-3 flex-wrap justify-center">
              <button
                onClick={() => {
                  setInput("I would like to run an investigation on Roman Abramovich, the details I have on him are he is Russian born in the 1960's.");
                }}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Roman Abramovich
              </button>
              <button
                onClick={() => {
                  setInput("I am investigating Russell Cherry, help me find his X account, He has worked previously as a councillor. Please analyse his profile with a focus on his political views and affiliations, as well as anything which could be deemed as controversial.");
                }}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Russell Cherry
              </button>
              <button
                onClick={() => {
                  setInput("Map the current sanctions-evasion ecosystem for Iranian petrochemicals, detailing producer and broker networks and maritime concealment patterns");
                }}
                className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80"
              >
                Iranian Petrochemicals
              </button>
              <button className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80">
                Abbas Araghchi
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header with New Chat button */}
          <div className="flex items-center justify-end px-4 py-4 border-b border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto py-8 space-y-6">
            <div className="max-w-4xl mx-auto w-full px-4 space-y-6">
              {messages.map((message, index) => (
                <div key={index} className={cn(
                  "rounded-lg p-4",
                  message.role === "user"
                    ? "bg-card border border-border ml-auto max-w-2xl"
                    : "bg-background"
                )}>
                  {message.role === "user" ? (
                    <p className="text-sm text-foreground">{message.content}</p>
                  ) : message.isReport ? (
                    <InvestigationReport name={message.content} />
                  ) : message.isAccountSelector ? (
                    <XAccountSelector onConfirm={handleAccountSelection} />
                  ) : message.isRussellCherryReport ? (
                    <RussellCherryReport username={message.selectedAccount || "russcherry5"} />
                  ) : message.isIranianPetrochemicalsReport ? (
                    <IranianPetrochemicalsReport />
                  ) : (
                    <p className="text-sm text-muted-foreground">{message.content}</p>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="rounded-lg border bg-background p-6">
                  <LoadingStages stages={loadingStages} />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Fixed Input at Bottom */}
          <div className="flex-shrink-0 border-t border-border bg-background py-4">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto w-full px-4">
              <div className={cn(
                "relative rounded-lg border bg-card transition-all duration-150",
                isFocused ? "border-primary shadow-[0_0_20px_rgba(56,189,248,0.15)]" : "border-border"
              )}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder="What would you like to investigate?"
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent px-4 pt-[14px] pb-[14px] pr-12 text-base text-foreground leading-[1.25]",
                    "placeholder:text-muted-foreground/50",
                    "focus:outline-none max-h-40 overflow-y-auto"
                  )}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                    input.trim() && !isLoading
                      ? "text-primary hover:bg-primary/10"
                      : "text-muted-foreground/30 cursor-not-allowed"
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};