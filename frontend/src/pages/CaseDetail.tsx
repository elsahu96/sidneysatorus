import { Sidebar } from "@/components/Sidebar";
import { useCaseFiles } from "@/contexts/CaseFilesContext";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useParams, useNavigate } from "react-router-dom";
import { InvestigationReport } from "@/components/InvestigationReport";
import { RussellCherryReport } from "@/components/RussellCherryReport";
import { TaiwanReport } from "@/components/TaiwanReport";
import { DarkWebReport } from "@/components/DarkWebReport";
import { IranianPetrochemicalsReport } from "@/components/IranianPetrochemicalsReport";
import { XAccountSelector } from "@/components/XAccountSelector";
import { BaghdadThreatHeatmap } from "@/components/BaghdadThreatHeatmap";
import { BaghdadMovementMap } from "@/components/BaghdadMovementMap";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, MessageCircle, Send, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { exportReportToPDF, exportReportMetadataToPDF } from "@/lib/pdfExport";
import { apiClient } from "@/api/api";
import { toast } from "sonner";

const CaseDetail = () => {
  const {
    id
  } = useParams();
  const navigate = useNavigate();
  const {
    getCaseFile,
    getProject
  } = useCaseFiles();
  const {
    isCollapsed
  } = useSidebarContext();
  const caseFile = id ? getCaseFile(id) : undefined;
  const project = caseFile?.projectId ? getProject(caseFile.projectId) : undefined;
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{
    role: "user" | "assistant";
    content: string;
  }>>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const darkWebFollowUpPrompt = "Which neighbourhoods in East Baghdad show the highest convergence of threat signals from these actors?";
  const darkWebFollowUpResponse = `Dark-web and Telegram references from both actors cluster around neighbourhoods with established AAH activity. The strongest convergence appears in:

**Sadr City (Thawra districts):** consistent militia recruitment narratives; multiple mentions of weapons availability.

**Baghdad al-Jadida:** proximity to reported volunteer mobilisation calls tied to East Baghdad rhetoric.

**Rustamiyah corridor:** aligns with historic AAH transit routes and several keyword-linked discussions regarding "volunteers entering the fray."

**Assessment:** These zones present the highest near-term risk for NGO activity due to overlap between extremist mobilisation narratives and existing militia influence.`;

  const movementFollowUpPrompt = "What changes should we make to our NGO field movements or partner vetting in the next 72 hours based on these findings?";
  const movementFollowUpResponse = "movement-recommendations";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [chatInput]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [chatMessages]);
  const handleChatSubmit = async (e: React.FormEvent, customInput?: string) => {
    e.preventDefault();
    const inputText = customInput || chatInput;
    if (!inputText.trim()) return;
    const userMessage = {
      role: "user" as const,
      content: inputText
    };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");

    // Check if this is the dark web follow-up question
    setTimeout(() => {
      let responseContent: string;
      if (inputText.trim() === darkWebFollowUpPrompt) {
        responseContent = darkWebFollowUpResponse;
      } else if (inputText.trim() === movementFollowUpPrompt) {
        responseContent = movementFollowUpResponse;
      } else {
        responseContent = `I understand you're asking about "${inputText}". Based on the investigation report, I can provide additional context and analysis. What specific aspect would you like me to elaborate on?`;
      }
      const assistantMessage = {
        role: "assistant" as const,
        content: responseContent
      };
      setChatMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  const handleFollowUpClick = (prompt: string) => {
    setShowChatPanel(true);
    // Small delay to ensure panel is open before submitting
    setTimeout(() => {
      setChatInput(prompt);
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handleChatSubmit(fakeEvent, prompt);
    }, 100);
  };
  if (!caseFile) {
    return <div className="flex h-screen w-full bg-background">
        <Sidebar />
        <main className={cn("flex-1 flex items-center justify-center transition-all duration-300", isCollapsed ? "ml-16" : "ml-64")}>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Case file not found</h2>
            <Button onClick={() => navigate("/case-files")} variant="outline">
              Back to Case Files
            </Button>
          </div>
        </main>
      </div>;
  }
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // Find the final report (last message that is a report)
  const finalReport = [...caseFile.messages].reverse().find(m => m.role === "assistant" && (m.isReport || m.isRussellCherryReport || m.isTaiwanReport || m.isDarkWebReport || m.isIranianPetrochemicalsReport));

  // Get all messages except the final report for chat history
  const chatHistory = finalReport ? caseFile.messages.slice(0, caseFile.messages.lastIndexOf(finalReport)) : caseFile.messages;
  return <div className="flex h-screen w-full bg-background">
      <Sidebar />
      <main className={cn(
        "flex-1 overflow-y-auto transition-all duration-300", 
        isCollapsed ? "ml-16" : "ml-64",
        showChatPanel ? "mr-[400px] sm:mr-[540px]" : ""
      )}>
        <div className="container mx-auto py-6 px-4 max-w-5xl">
          <Button onClick={() => navigate("/case-files")} variant="ghost" size="sm" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Case Files
          </Button>
          <Card className="overflow-hidden border-border/50">
            <div className="bg-gradient-to-br from-primary/10 via-background to-background p-8 border-b">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-foreground mb-2">
                    {caseFile.subject}
                  </h1>
                  {project && <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(caseFile.timestamp)}</span>
                      <span className="mx-2">•</span>
                      <span className="text-primary font-medium">{project.name}</span>
                    </div>}
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled={exportingPdf}
                    onClick={async () => {
                      if (finalReport?.isReport) {
                        setExportingPdf(true);
                        try {
                          const report = await apiClient.getReport(caseFile.caseNumber);
                          exportReportMetadataToPDF(report);
                          toast.success("Report exported to PDF");
                        } catch {
                          toast.error("Failed to fetch report for export");
                        } finally {
                          setExportingPdf(false);
                        }
                      } else {
                        exportReportToPDF(caseFile);
                        toast.success("Report exported to PDF");
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {exportingPdf ? "Exporting…" : "Export PDF"}
                  </Button>
                  <Button onClick={() => setShowChatPanel(!showChatPanel)} size="sm" className="gap-2 bg-primary hover:bg-primary/90">
                    <MessageCircle className="h-4 w-4" />
                    Follow-up Questions
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6">
              {finalReport?.isRussellCherryReport && <RussellCherryReport username="russcherry5" />}
              {finalReport?.isTaiwanReport && <TaiwanReport />}
              {finalReport?.isDarkWebReport && <DarkWebReport onFollowUpClick={handleFollowUpClick} />}
              {finalReport?.isIranianPetrochemicalsReport && <IranianPetrochemicalsReport />}
              {finalReport?.isReport && !finalReport.isRussellCherryReport && !finalReport.isTaiwanReport && !finalReport.isDarkWebReport && !finalReport.isIranianPetrochemicalsReport && <InvestigationReport name={finalReport.content} />}
              {!finalReport && <div className="text-center py-12">
                  <p className="text-muted-foreground">No investigation report available yet.</p>
                </div>}
              {chatHistory.length > 0 && <div className="mt-8 pt-8 border-t">
                  <button onClick={() => setShowChatHistory(!showChatHistory)} className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary transition-colors mb-4">
                    Chat History
                    {showChatHistory ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </button>
                  {showChatHistory && <div className="space-y-4 pl-4 border-l-2 border-border/50">
                      {chatHistory.map((msg, idx) => <div key={idx} className={cn("p-4 rounded-lg", msg.role === "user" ? "bg-primary/5" : "bg-muted/30")}>
                          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                            {msg.role === "user" ? "You" : "Sidney"}
                          </div>
                          {msg.isAccountSelector ? <XAccountSelector onConfirm={() => {}} readonly selectedUsername="russcherry5" /> : <div className="text-sm text-foreground whitespace-pre-wrap">
                              {msg.content}
                            </div>}
                        </div>)}
                    </div>}
                </div>}
            </div>
          </Card>
        </div>
      </main>

      {/* Chat Panel - Side by Side */}
      {showChatPanel && <aside className="fixed right-0 top-0 h-screen w-[400px] sm:w-[540px] border-l bg-background flex flex-col transition-all duration-300 z-40">
          <div className="px-6 py-4 border-b bg-background/50 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Follow-up Questions</h2>
              <p className="text-sm text-muted-foreground">
                {caseFile.subject}
              </p>
            </div>
            <Button onClick={() => setShowChatPanel(false)} variant="ghost" size="icon" className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="max-w-sm">
                  <MessageCircle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-6">
                    Start a conversation to ask follow-up questions about this investigation.
                  </p>
                  {finalReport?.isDarkWebReport && (
                    <div className="text-left space-y-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Suggested questions:</p>
                      <button
                        onClick={() => handleFollowUpClick(darkWebFollowUpPrompt)}
                        className="w-full text-left p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all"
                      >
                        <p className="text-sm text-foreground/90">
                          "{darkWebFollowUpPrompt}"
                        </p>
                      </button>
                      <button
                        onClick={() => handleFollowUpClick(movementFollowUpPrompt)}
                        className="w-full text-left p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/50 transition-all"
                      >
                        <p className="text-sm text-foreground/90">
                          "{movementFollowUpPrompt}"
                        </p>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                {chatMessages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={cn(
                      "rounded-lg p-3 text-sm",
                      msg.role === "user" 
                        ? "bg-primary/10 ml-auto max-w-[85%]" 
                        : "bg-muted/50 max-w-[85%]"
                    )}
                  >
                    {msg.content.includes("Dark-web and Telegram references from both actors cluster") ? (
                      <div className="space-y-3">
                        <p className="text-foreground/90 leading-relaxed">
                          Dark-web and Telegram references from both actors cluster around neighbourhoods with established AAH activity. The strongest convergence appears in:
                        </p>
                        <div className="space-y-2 ml-2">
                          <div>
                            <span className="font-semibold text-foreground">Sadr City (Thawra districts):</span>
                            <span className="text-foreground/80 ml-1">consistent militia recruitment narratives; multiple mentions of weapons availability.</span>
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">Baghdad al-Jadida:</span>
                            <span className="text-foreground/80 ml-1">proximity to reported volunteer mobilisation calls tied to East Baghdad rhetoric.</span>
                          </div>
                          <div>
                            <span className="font-semibold text-foreground">Rustamiyah corridor:</span>
                            <span className="text-foreground/80 ml-1">aligns with historic AAH transit routes and several keyword-linked discussions regarding "volunteers entering the fray."</span>
                          </div>
                        </div>
                        <div className="mt-3 p-2 rounded-md bg-primary/10 border border-primary/20">
                          <span className="font-semibold text-foreground">Assessment:</span>
                          <span className="text-foreground/90 ml-1">These zones present the highest near-term risk for NGO activity due to overlap between extremist mobilisation narratives and existing militia influence.</span>
                        </div>
                        <div className="mt-4">
                          <BaghdadThreatHeatmap />
                        </div>
                      </div>
                    ) : msg.content === "movement-recommendations" ? (
                      <div className="space-y-3">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-foreground mb-2 text-sm">Immediate Movement Adjustments (0-72 hrs):</h4>
                            <ul className="space-y-1.5 ml-3 text-foreground/80">
                              <li className="flex items-start gap-2">
                                <span className="text-destructive mt-0.5">•</span>
                                <span>Suspend all non-essential movements in Sadr City, Baghdad al-Jadida, and the Rustamiyah belt.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-orange-500 mt-0.5">•</span>
                                <span>Shift high-visibility activity to low-risk districts; prioritise compound-to-compound travel only.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-yellow-500 mt-0.5">•</span>
                                <span>Increase movement unpredictability (route variation and departure time staggering).</span>
                              </li>
                            </ul>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-foreground mb-2 text-sm">Partner & Personnel Vetting:</h4>
                            <ul className="space-y-1.5 ml-3 text-foreground/80">
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>Re-screen all local partners with ties to Basra military units due to the insider threat identified via "uncle_mo."</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>Conduct accelerated checks on drivers, fixers, and guards for prison history or militia affiliation.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
                                <span>Engage vetted host-nation security contacts for cross-verification of both usernames and any associated networks.</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-2 rounded-md bg-orange-500/10 border border-orange-500/30">
                          <span className="font-semibold text-orange-500 text-sm">Overall posture:</span>
                          <span className="text-foreground/90 ml-1">Move to heightened alert until both actors are either dormant or neutralised by authorities.</span>
                        </div>
                        
                        <div className="mt-4">
                          <BaghdadMovementMap />
                        </div>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            )}
            </div>
          </div>

          <div className="flex-shrink-0 border-t bg-background/50 px-6 py-4">
            <form onSubmit={handleChatSubmit} className="relative">
              <textarea 
                ref={textareaRef} 
                value={chatInput} 
                onChange={e => setChatInput(e.target.value)} 
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit(e);
                  }
                }} 
                placeholder="Ask a follow-up question..." 
                rows={1} 
                className={cn(
                  "w-full resize-none rounded-lg border border-border bg-background px-4 py-3 pr-12 text-sm",
                  "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary",
                  "max-h-32 overflow-y-auto"
                )} 
              />
              <button 
                type="submit" 
                disabled={!chatInput.trim()} 
                className={cn(
                  "absolute right-3 bottom-3 rounded-md p-1.5 transition-all",
                  chatInput.trim() 
                    ? "text-primary hover:bg-primary/10" 
                    : "text-muted-foreground/30 cursor-not-allowed"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </aside>}
    </div>;
};
export default CaseDetail;