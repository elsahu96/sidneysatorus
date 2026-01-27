import { Sidebar } from "@/components/Sidebar";
import { useSidebarContext } from "@/contexts/SidebarContext";
import { useCaseFiles } from "@/contexts/CaseFilesContext";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Shield, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { ProjectSelector } from "@/components/ProjectSelector";
import { Project } from "@/contexts/CaseFilesContext";
import { toast } from "sonner";
import { BaghdadThreatHeatmap } from "@/components/BaghdadThreatHeatmap";
import { BaghdadMovementMap } from "@/components/BaghdadMovementMap";

const DarkWeb = () => {
  const { isCollapsed } = useSidebarContext();
  const { projects, addReportToProject } = useCaseFiles();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingSection, setLoadingSection] = useState<number>(0);
  const [reportSaved, setReportSaved] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  }, [input]);

  const neighbourhoodFollowUpPrompt = "Which neighbourhoods in East Baghdad show the highest convergence of threat signals from these actors?";
  const neighbourhoodFollowUpResponse = `Dark-web and Telegram references from both actors cluster around neighbourhoods with established AAH activity. The strongest convergence appears in:

**Sadr City (Thawra districts):** consistent militia recruitment narratives; multiple mentions of weapons availability.

**Baghdad al-Jadida:** proximity to reported volunteer mobilisation calls tied to East Baghdad rhetoric.

**Rustamiyah corridor:** aligns with historic AAH transit routes and several keyword-linked discussions regarding "volunteers entering the fray."

**Assessment:** These zones present the highest near-term risk for NGO activity due to overlap between extremist mobilisation narratives and existing militia influence.`;

  const movementFollowUpPrompt = "What changes should we make to our NGO field movements or partner vetting in the next 72 hours based on these findings?";
  const movementFollowUpResponse = "movement-recommendations";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedProject) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Mock response for dark web investigation
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let responseContent = "";
    
    // Check if this is the neighbourhood follow-up question
    if (input.trim() === neighbourhoodFollowUpPrompt) {
      responseContent = neighbourhoodFollowUpResponse;
    }
    // Check if this is the movement follow-up question
    else if (input.trim() === movementFollowUpPrompt) {
      responseContent = movementFollowUpResponse;
    }
    // Check if this is the AAH collection plan query
    else if (input.includes("Asa'ib Ahl al-Haq") || input.includes("AAH")) {
      responseContent = "aah-collection-plan";
    } else if (messages.length > 0 && messages[messages.length - 1]?.content === "aah-collection-plan" && 
               (input.toLowerCase().includes("yes") || input.toLowerCase().includes("good") || 
                input.toLowerCase().includes("looks good") || input.toLowerCase().includes("proceed") ||
                input.toLowerCase().includes("happy") || input.toLowerCase().includes("approve"))) {
      responseContent = "aah-full-report";
      setLoadingSection(0);
      setReportSaved(false);
    } else {
      responseContent = `Dark web investigation initiated for project "${selectedProject.name}". Scanning encrypted channels and hidden forums for threat intelligence related to your query...`;
    }
    
    const assistantMessage = {
      role: "assistant" as const,
      content: responseContent
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    setIsLoading(false);
  };

  // Progressive loading effect for report sections
  useEffect(() => {
    if (messages.some(m => m.content === "aah-full-report") && loadingSection < 10) {
      const timer = setTimeout(() => {
        setLoadingSection(prev => prev + 1);
      }, 600);
      return () => clearTimeout(timer);
    }
    
    // Save report when all sections are loaded (only once)
    if (loadingSection === 10 && !reportSaved) {
      const humanitarianProject = projects.find(p => p.name === "Humanitarian Aid");
      if (humanitarianProject) {
        const reportData = {
          id: `report-${Date.now()}`,
          caseNumber: "AAH Threat Assessment — East Baghdad",
          subject: "Dark Web Investigation",
          timestamp: Date.now(),
          projectId: humanitarianProject.id,
          messages: [{
            role: "assistant" as const,
            content: "aah-full-report",
            isDarkWebReport: true
          }]
        };
        addReportToProject(humanitarianProject.id, reportData);
        toast.success("Report saved to Humanitarian Aid project");
        setReportSaved(true);
      }
    }
  }, [messages, loadingSection, reportSaved, projects, addReportToProject]);

  return (
    <div className="flex h-screen w-full bg-background">
      <Sidebar />
      <main className={cn(
        "flex-1 h-screen overflow-y-auto transition-all duration-300",
        isCollapsed ? "ml-16" : "ml-64"
      )}>
        <div className="flex flex-col px-4 h-full">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center">
              {/* Shield Icon and Welcome */}
              <div className="mb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-primary/10 p-4">
                    <Shield className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h2 className="mb-2 text-3xl font-semibold text-foreground">
                  Dark Web Intelligence
                </h2>
                <p className="text-sm text-muted-foreground">
                  Secure threat mapping and investigation platform
                </p>
              </div>

              {/* Project Selector */}
              <div className="mb-6 w-full max-w-3xl">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Select Project
                </label>
                <ProjectSelector
                  projects={projects}
                  selectedProject={selectedProject}
                  onSelectProject={setSelectedProject}
                />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSubmit} className="w-full max-w-3xl">
                <div className={cn(
                  "relative rounded-lg border bg-card transition-all duration-150",
                  isFocused ? "border-primary shadow-[0_0_20px_rgba(56,189,248,0.15)]" : "border-border",
                  !selectedProject && "opacity-50 pointer-events-none"
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
                    placeholder={selectedProject ? "Describe the threat or entity to investigate..." : "Please select a project first"}
                    rows={1}
                    disabled={!selectedProject}
                    className={cn(
                      "w-full resize-none bg-transparent px-4 pt-[14px] pb-[14px] pr-12 text-base text-foreground leading-[1.25]",
                      "placeholder:text-muted-foreground/50",
                      "focus:outline-none max-h-40 overflow-y-auto"
                    )}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading || !selectedProject}
                    className={cn(
                      "absolute right-3 bottom-3 rounded-md p-1.5 transition-all duration-150",
                      input.trim() && !isLoading && selectedProject
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
              <div className="mt-6 w-full max-w-3xl">
                <p className="mb-3 text-xs text-muted-foreground">Suggested examples</p>
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => selectedProject && setInput("Investigate current dark web discussions linked to Asa'ib Ahl al-Haq (AAH) and assess risk to NGOs in East Baghdad.")}
                    disabled={!selectedProject}
                    className={cn(
                      "rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80",
                      !selectedProject && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    East Baghdad Threats
                  </button>
                  <button
                    onClick={() => selectedProject && setInput("Identify militant groups active in humanitarian aid corridors")}
                    disabled={!selectedProject}
                    className={cn(
                      "rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80",
                      !selectedProject && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Militant Groups
                  </button>
                  <button
                    onClick={() => selectedProject && setInput("Analyze recent communications from extremist forums regarding NGO activities")}
                    disabled={!selectedProject}
                    className={cn(
                      "rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground/80 transition-all hover:border-primary hover:bg-card/80",
                      !selectedProject && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Forum Intelligence
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {selectedProject?.name}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Safe Mode Active: Read-Only mode preserves analyst safety.
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto py-8">
                <div className="max-w-4xl mx-auto w-full px-4 space-y-6">
                {messages.map((message, index) => (
                  <div key={index} className={cn(
                    "rounded-lg p-4",
                    message.role === "user" 
                      ? "bg-card border border-border ml-auto max-w-2xl" 
                      : "bg-background"
                  )}>
                    {message.role === "assistant" && message.content === "aah-collection-plan" ? (
                      <div className="space-y-6">
                        {/* Header */}
                        <div className="border-b border-border pb-4">
                          <h2 className="text-2xl font-semibold text-foreground mb-2">
                            Collection Plan — Asa'ib Ahl al-Haq (AAH) / East Baghdad
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            I've prepared a collection plan based on your request. Here's what I'm proposing for the search scope, language sets, and safety parameters.
                          </p>
                        </div>

                        {/* Section 1 – Objective */}
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-foreground">Objective</h3>
                          <p className="text-sm text-foreground/80 leading-relaxed">
                            I'll identify and monitor AAH-linked digital activity that may pose threats to NGO staff in East Baghdad, using read-only, multilingual open- and dark-web collection.
                          </p>
                        </div>

                        {/* Section 2 – Scope Overview */}
                        <div className="space-y-3">
                          <h3 className="text-lg font-semibold text-foreground">Scope Overview</h3>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-foreground">Source Types: </span>
                              <span className="text-foreground/80">Surface Web, Telegram, Indexed Dark-Web Archives</span>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Timeframe: </span>
                              <span className="text-foreground/80">Past 12 months (priority last 6)</span>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Languages: </span>
                              <span className="text-foreground/80">Arabic (MSA + dialect), English transliteration</span>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Focus Regions: </span>
                              <span className="text-foreground/80">East Baghdad, Basra</span>
                            </div>
                            <div>
                              <span className="font-medium text-foreground">Mode: </span>
                              <span className="text-foreground/80">Read-Only (Safe Sandbox Enabled)</span>
                            </div>
                          </div>
                        </div>

                        {/* Section 3 – Keyword Matrix */}
                        <div className="space-y-3">
                          <h3 className="text-lg font-semibold text-foreground">Keyword Matrix</h3>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { ar: "عصائب أهل الحق", en: "Asa'ib Ahl al-Haq" },
                              { ar: "الحشد الشعبي", en: "Hashd al-Shaabi / PMF" },
                              { ar: "مقاومة", en: "Resistance / Martyr" },
                              { ar: "فساد", en: "Corruption" },
                              { ar: "تجنيد", en: "Recruitment / Volunteer" },
                              { ar: "سلاح", en: "Weapons / Arms Sale" }
                            ].map((keyword, i) => (
                              <div key={i} className="rounded-lg border border-border bg-card px-3 py-2">
                                <div className="text-sm font-medium text-foreground">{keyword.ar}</div>
                                <div className="text-xs text-muted-foreground">{keyword.en}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="space-y-4 pt-4 border-t border-border">
                          {/* Approval Prompt */}
                          <div className="rounded-lg bg-card/50 border border-primary/20 p-4">
                            <p className="text-sm text-foreground font-medium">
                              Does this collection plan look good to you? I can adjust the scope, timeframe, or keywords if needed before we proceed.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : message.role === "assistant" && message.content === "aah-full-report" ? (
                      <div className="space-y-8">
                        {/* Report Header */}
                        {loadingSection >= 1 ? (
                          <div className="border-b border-border pb-4">
                            <h2 className="text-3xl font-semibold text-foreground mb-2">
                              AAH Threat Assessment — East Baghdad
                            </h2>
                            <p className="text-sm text-muted-foreground">
                              Investigation complete. Here's what I found from the dark web collection.
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Generating report...</span>
                          </div>
                        )}

                        {/* Methodology - Collapsible */}
                        {loadingSection >= 2 ? (
                          <div className="space-y-4">
                            <button
                              onClick={() => setShowMethodology(!showMethodology)}
                              className="flex items-center justify-between w-full text-left group rounded-lg border border-border bg-card/50 p-4 hover:bg-card transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <h3 className="text-xl font-semibold text-foreground">Methodology</h3>
                                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                                  {showMethodology ? "Hide" : "View details"}
                                </span>
                              </div>
                              {showMethodology ? (
                                <ChevronUp className="h-5 w-5 text-primary transition-colors" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-primary transition-colors" />
                              )}
                            </button>
                            {showMethodology && (
                              <div className="space-y-3">
                              {[
                                {
                                  title: "Identified key words and themes",
                                  content: "After reviewing Telegram discussions about Asa'ib Ahl al-Haq (AAH), I noted the Arabic words that appeared most often such as مقاومة (\"resistance/martyr\"), عصائب أهل الحق (\"AAH/volunteer\"), and فساد (\"corruption\"). These became my search anchors for locating related conversations elsewhere online."
                                },
                                {
                                  title: "Extended the search to the dark web",
                                  content: "Using a secure, read-only research setup, I ran these Arabic keywords through indexed dark-web archives. The goal was to understand how extremist or militia-aligned users were discussing the same topics outside public social platforms."
                                },
                                {
                                  title: "Logged and reviewed all results",
                                  content: "Each hit was captured with its alias, page number, and retrieval date. I recorded the surrounding conversation to identify whether the tone suggested general discussion or direct threats."
                                },
                                {
                                  title: "Flagged high-risk content for deeper review",
                                  content: "Two user handles stood out because their posts moved from discussion to explicit or implicit threat activity."
                                },
                                {
                                  title: "Archived evidence securely",
                                  content: "All relevant posts were preserved in a document with timestamps to maintain a chain of custody for possible referral to authorities."
                                },
                                {
                                  title: "Analysed each actor",
                                  content: "For both users I reviewed language, context, geography, and intent. Each was assessed for capability, motivation, and proximity to AAH activity or NGO operating areas."
                                },
                                {
                                  title: "Correlated findings with local conditions",
                                  content: "I compared the posts to open-source reporting on militia operations, recent violence in East Baghdad, and known patterns of PMF recruitment in Basra. This helped determine which threats were credible and which were background noise."
                                },
                                {
                                  title: "Compiled threat profiles and summary",
                                  content: "All verified data were organised into a report. These fed into the final summary assessing overall AAH-linked extremist risk to NGOs working in East Baghdad."
                                },
                                {
                                  title: "Escalated and recommended actions",
                                  content: "The evidence and analytic conclusions were passed to appropriate security partners for verification, and recommendations were issued for field posture, partner vetting, and continued monitoring."
                                }
                              ].map((step, i) => (
                                <div key={i} className="rounded-lg border border-border bg-card/30 p-4">
                                  <h4 className="text-sm font-semibold text-foreground mb-2">{step.title}</h4>
                                  <p className="text-sm text-foreground/80 leading-relaxed">{step.content}</p>
                                </div>
                              ))}
                              </div>
                            )}
                          </div>
                        ) : loadingSection >= 1 ? (
                          <div className="flex items-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Loading methodology...</span>
                          </div>
                        ) : null}

                        {/* Executive Summary */}
                        {loadingSection >= 3 ? (
                          <div className="space-y-4">
                          <h3 className="text-xl font-semibold text-foreground">Executive Summary (BLUF)</h3>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-semibold text-foreground">Investigation objective: </span>
                              <span className="text-foreground/80">Identify dangerous actors associated (directly or indirectly) with Asa'ib Ahl al-Haq (AAH) and assess the risk they pose to NGO staff operating in East Baghdad.</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Outcome: </span>
                              <span className="text-foreground/80">Two hostile actor clusters identified from read-only dark-web analysis: (1) an active recruiter/arms seller calling volunteers to arms in East Baghdad, and (2) an ex-prisoner cell with extremist sympathies linked to elements of the Iraqi military. Both findings require immediate operational mitigation and legal escalation.</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Confidence: </span>
                              <span className="text-foreground/80">Moderate for socio-digital sentiment and actor presence; Low-Moderate for attribution of specific criminal transactions until forensic corroboration is complete.</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Immediate recommendation: </span>
                              <span className="text-foreground/80">Suspend high-visibility field activities in affected neighbourhoods, activate emergency liaison with host-nation security partners, and begin case handover to authorities with evidence packages (redacted as required).</span>
                            </div>
                          </div>
                        </div>
                        ) : loadingSection >= 2 ? (
                          <div className="flex items-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Loading executive summary...</span>
                          </div>
                        ) : null}

                        {/* Investigation Objectives */}
                        {loadingSection >= 5 ? (
                          <div className="space-y-4">
                          <h3 className="text-xl font-semibold text-foreground">Investigation Objectives & Scope</h3>
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="font-semibold text-foreground">Primary objective: </span>
                              <span className="text-foreground/80">Map, verify, and characterise dangerous individuals/groups whose rhetoric or activity directly increase risk to NGO staff in East Baghdad.</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground block mb-2">Secondary objectives:</span>
                              <ul className="list-disc list-inside space-y-1 text-foreground/80 ml-2">
                                <li>Measure public sentiment toward AAH in East Baghdad and correlate narrative spikes with on-the-ground incidents.</li>
                                <li>Produce evidence packages fit for legal referral and internal risk mitigation.</li>
                              </ul>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground block mb-2">Scope limitations & exclusions:</span>
                              <ul className="list-disc list-inside space-y-1 text-foreground/80 ml-2">
                                <li>Read-only collection is all that can be used (no engagement, no infiltration).</li>
                                <li>No operational advice on weapon procurement or illicit trade.</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        ) : loadingSection >= 4 ? (
                          <div className="flex items-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Loading investigation objectives...</span>
                          </div>
                        ) : null}

                        {/* Threat Actor 1 */}
                        {loadingSection >= 7 ? (
                          <div className="space-y-4 rounded-lg border border-border bg-card/50 p-6">
                          <h3 className="text-xl font-semibold text-foreground">Threat Actor 1: AndreasRybak</h3>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-semibold text-foreground">Handle: </span>
                              <span className="text-foreground/80">AndreasRybak</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Platform(s): </span>
                              <span className="text-foreground/80">Dark-web forum ("Darknetmarketnoobs")</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Language: </span>
                              <span className="text-foreground/80">English and Arabic (poorly translated - likely non-native)</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Geographic Focus: </span>
                              <span className="text-foreground/80">Iraq and Syria</span>
                            </div>
                          </div>

                          <div>
                            <span className="font-semibold text-foreground block mb-2 text-sm">Discovery Method:</span>
                            <p className="text-sm text-foreground/80">
                              Keyword search for Arabic terms مقاومة ("resistance/martyr") and عصائب أهل الحق ("volunteer") produced cross-referenced hits on indexed dark-web pages.
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-foreground/80 ml-2">
                              <li>مقاومة - Produced a hit on page 76</li>
                              <li>عصائب أهل الحق - Produced a hit on page 34</li>
                            </ul>
                          </div>

                          <div>
                            <span className="font-semibold text-foreground block mb-2 text-sm">Quotes of Interest:</span>
                            <div className="space-y-3">
                              <div className="rounded-md bg-background/50 p-3 border-l-2 border-primary/30">
                                <p className="text-sm text-foreground/80 italic mb-1">
                                  "Get some followers together, arm up (either making your own arms or acquiring them from a trusted intermediary if you have one), and kill whoever it is that threatens you and the people in your group. The Taliban did this and were able to get popular support in post-Soviet Afghanistan because people were tired of little boys getting raped for Afghan elders' amusement and Mullah Omar and his students were hanging the rapists from the guns of rusted tanks. If you keep up the work and continue to build good relations with the people who appreciate your willingness to try and keep them safe, you might end up running the country one day. With all due respect, they're eventually going to try and kill you for being too 'moderate' and 'tolerant' a Muslim in their eyes. You might as well kill as many of them as you can before they try. Who knows? You might save the country."
                                </p>
                                <span className="text-xs text-muted-foreground">02/25</span>
                              </div>
                              <div className="rounded-md bg-background/50 p-3 border-l-2 border-primary/30">
                                <p className="text-sm text-foreground/80 italic mb-1">
                                  "Would be a good one. Was thinking more of getting people over and into the fray. There are thousands of volunteers who want to get involved."
                                </p>
                                <span className="text-xs text-muted-foreground">01/25</span>
                              </div>
                              <div className="rounded-md bg-background/50 p-3 border-l-2 border-primary/30">
                                <p className="text-sm text-foreground/80 italic mb-1">
                                  "I have RPG-7s sold on Telegram over in Iraq and Syria"
                                </p>
                                <span className="text-xs text-muted-foreground">10/24</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="font-semibold text-foreground block mb-2 text-sm">Analysis:</span>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              Analysis indicates that AndreasRybak presents as a self-motivated violent extremist or arms facilitator operating across dark-web and Telegram ecosystems. His rhetoric combines ideological justification with operational intent, explicitly urging others to "arm up" and "kill whoever threatens your group," while invoking Taliban tactics as a model for local mobilisation. References to East Baghdad and the sale of "RPG-7s on Telegram over in Iraq and Syria" suggest proximity to existing militia markets and a functional understanding of cross-border arms flows. The language and timing of his posts align closely with AAH-adjacent resistance narratives, which glorify the defence of "the people" against internal and foreign enemies. While a direct command-and-control link to AAH cannot be confirmed, his discourse reinforces the group's propaganda ecosystem and could serve as an informal recruitment or facilitation node. From a threat perspective, his posts demonstrate both intent and capability - intent through repeated calls to violent action, and capability through claims of weapons access and recruitment outreach. For NGOs and humanitarian staff in East Baghdad, this represents a credible, near-term threat vector that could inspire or coordinate hostile acts.
                            </p>
                          </div>
                        </div>
                        ) : loadingSection >= 6 ? (
                          <div className="flex items-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Analyzing threat actor 1...</span>
                          </div>
                        ) : null}

                        {/* Threat Actor 2 */}
                        {loadingSection >= 9 ? (
                          <div className="space-y-4 rounded-lg border border-border bg-card/50 p-6">
                          <h3 className="text-xl font-semibold text-foreground">Threat Actor 2: uncle_mo</h3>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-semibold text-foreground">Handle: </span>
                              <span className="text-foreground/80">uncle_mo</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Platform(s): </span>
                              <span className="text-foreground/80">Dark-web forum Dread / Various chats</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Language: </span>
                              <span className="text-foreground/80">English transliteration with regional phrasing</span>
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">Geographic Focus: </span>
                              <span className="text-foreground/80">Basra Governorate</span>
                            </div>
                          </div>

                          <div>
                            <span className="font-semibold text-foreground block mb-2 text-sm">Discovery Method:</span>
                            <p className="text-sm text-foreground/80">
                              Keyword search for فساد ("corruption") flagged thread discussing prison conditions in Basra, Iraq.
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-foreground/80 ml-2">
                              <li>فساد - Produced a hit on page 68</li>
                            </ul>
                          </div>

                          <div>
                            <span className="font-semibold text-foreground block mb-2 text-sm">Quotes of Interest:</span>
                            <div className="space-y-3">
                              <div className="rounded-md bg-background/50 p-3 border-l-2 border-primary/30">
                                <p className="text-sm text-foreground/80 italic mb-1">
                                  "there's an active war in my area. No one gets in or out unless you work for the militia, that is what I had to do."
                                </p>
                                <span className="text-xs text-muted-foreground">03/25</span>
                              </div>
                              <div className="rounded-md bg-background/50 p-3 border-l-2 border-primary/30">
                                <p className="text-sm text-foreground/80 italic mb-1">
                                  "yes, dread was shut down for a few months. Ironically, i got involved in a legal trouble and while in prison i thought maybe authority seized it and got to know a lot of things going on in the dark"
                                </p>
                                <span className="text-xs text-muted-foreground">01/25</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="font-semibold text-foreground block mb-2 text-sm">Analysis:</span>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              The user uncle_mo appears to belong to an emerging post-incarceration militant sub-network centred in Basra, a region with known militia penetration of formal security structures. His posts describe an environment in which "no one gets in or out unless you work for the militia," implying effective territorial control by armed groups and the coercive integration of civilians (particularly released inmates) into those networks. His reference to prison time and exposure to "a lot of things going on in the dark" suggests both insider knowledge of local corruption and normalisation of militant culture among ex-prisoners. While uncle_mo does not explicitly advocate violence, his narrative corroborates broader reporting of forced recruitment and ideological radicalisation within detention facilities feeding into PMF-aligned units, including those sympathetic to AAH. This raises a secondary but significant risk: infiltration of NGO operating environments by individuals with divided loyalties or extremist leanings, particularly through military liaisons, drivers, or local guards. The account's anonymity limits attribution, yet the linguistic and contextual consistency with verified Basra security trends lends the reporting moderate credibility. Taken together, the postings point to an insider-threat dimension rather than an external attack risk - underscoring the need for stricter partner vetting, closer coordination with vetted Iraqi security elements, and continuous monitoring for indicators of ideological leakage within local support networks.
                            </p>
                          </div>
                        </div>
                        ) : loadingSection >= 8 ? (
                          <div className="flex items-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Analyzing threat actor 2...</span>
                          </div>
                        ) : null}

                        {/* Summary */}
                        {loadingSection >= 10 ? (
                          <div className="space-y-4">
                          <h3 className="text-xl font-semibold text-foreground">Summary</h3>
                          <div className="space-y-3 text-sm text-foreground/80 leading-relaxed">
                            <p>
                              This investigation examined the presence of dangerous actors associated with Asa'ib Ahl al-Haq (AAH) and the broader militia ecosystem operating in Iraq, with a specific focus on threats to NGO personnel in East Baghdad. Using Sidney's open-source and dark-web collection workflows, analysts conducted targeted keyword searches in Arabic (مقاومة – "resistance/martyr", عصائب أهل الحق – "AAH/volunteer", فساد – "corruption") across indexed darknet forums and surface-web sources.
                            </p>
                            <p>
                              The search surfaced two distinct threat actors of operational concern. The first, using the alias AndreasRybak, was identified as an active recruiter and possible arms facilitator promoting violence in East Baghdad. His posts called for followers to arm themselves and referenced access to RPG-7s via Telegram channels operating across Iraq and Syria. The tone and timing of his communications mirror AAH-aligned resistance rhetoric, positioning him within the same ideological ecosystem even if not formally affiliated. This actor poses a direct, near-term threat due to his explicit incitement of violence and proximity to NGO activity zones.
                            </p>
                            <p>
                              The second actor, under the handle uncle_mo, was encountered during follow-on searches for corruption-related discourse. His posts describe life inside and after imprisonment in Basra, highlighting militia dominance over movement and recruitment of ex-inmates into armed structures. While not overtly calling for violence, the narrative aligns with reports of forced or voluntary absorption of ex-convicts into PMF-linked military units, some with extremist leanings. This presents an indirect but credible insider-threat risk to NGOs cooperating with local security elements, potentially influenced by such individuals.
                            </p>
                            <p>
                              Overall, the investigation confirms that AAH-related extremist sentiment remains active and adaptive, using both open and hidden digital ecosystems to recruit, arm, and legitimise militia operations. The digital traces uncovered support the hypothesis that East Baghdad remains a high-risk operating environment, particularly during election-related unrest, where online mobilisation rhetoric can quickly translate into real-world volatility. The findings have been referred to the appropriate authorities for action.
                            </p>
                            <p className="font-semibold text-foreground">
                              Recommended next steps include maintaining a heightened security posture for all field operations in East Baghdad, immediate re-vetting of local partners with military ties, and continuous monitoring of dark-web chatter for re-emergence of the identified handles or associated narratives.
                            </p>
                          </div>

                          {/* Suggested Follow-ups */}
                          <div className="mt-6 p-4 rounded-lg border border-primary/30 bg-primary/5">
                            <div className="flex items-start gap-3 mb-3">
                              <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
                              <h4 className="text-base font-semibold text-foreground">Suggested Follow-ups</h4>
                            </div>
                            <div className="space-y-2">
                              <button
                                onClick={() => setInput(neighbourhoodFollowUpPrompt)}
                                className="w-full text-left p-3 rounded-lg border border-border bg-background hover:bg-muted/50 hover:border-primary/50 transition-all group"
                              >
                                <p className="text-sm text-foreground/90 group-hover:text-foreground">
                                  "{neighbourhoodFollowUpPrompt}"
                                </p>
                              </button>
                              <button
                                onClick={() => setInput(movementFollowUpPrompt)}
                                className="w-full text-left p-3 rounded-lg border border-border bg-background hover:bg-muted/50 hover:border-primary/50 transition-all group"
                              >
                                <p className="text-sm text-foreground/90 group-hover:text-foreground">
                                  "{movementFollowUpPrompt}"
                                </p>
                              </button>
                            </div>
                          </div>
                        </div>
                        ) : loadingSection >= 9 ? (
                          <div className="flex items-center gap-3 py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Compiling summary...</span>
                          </div>
                        ) : null}
                      </div>
                    ) : message.content.includes("Dark-web and Telegram references from both actors cluster") ? (
                      <div className="space-y-4 text-sm">
                        <p className="text-foreground/90 leading-relaxed">
                          Dark-web and Telegram references from both actors cluster around neighbourhoods with established AAH activity. The strongest convergence appears in:
                        </p>
                        <div className="space-y-3 ml-2">
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
                        <div className="mt-4 p-3 rounded-md bg-primary/10 border border-primary/20">
                          <span className="font-semibold text-foreground">Assessment:</span>
                          <span className="text-foreground/90 ml-1">These zones present the highest near-term risk for NGO activity due to overlap between extremist mobilisation narratives and existing militia influence.</span>
                        </div>
                        <div className="mt-6">
                          <BaghdadThreatHeatmap />
                        </div>
                      </div>
                    ) : message.content === "movement-recommendations" ? (
                      <div className="space-y-4 text-sm">
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Immediate Movement Adjustments (0-72 hrs):</h4>
                            <ul className="space-y-2 ml-4 text-foreground/80">
                              <li className="flex items-start gap-2">
                                <span className="text-destructive mt-1">•</span>
                                <span>Suspend all non-essential movements in Sadr City, Baghdad al-Jadida, and the Rustamiyah belt.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-orange-500 mt-1">•</span>
                                <span>Shift high-visibility activity to low-risk districts; prioritise compound-to-compound travel only.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-yellow-500 mt-1">•</span>
                                <span>Increase movement unpredictability (route variation and departure time staggering).</span>
                              </li>
                            </ul>
                          </div>
                          
                          <div>
                            <h4 className="font-semibold text-foreground mb-2">Partner & Personnel Vetting:</h4>
                            <ul className="space-y-2 ml-4 text-foreground/80">
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-1">•</span>
                                <span>Re-screen all local partners with ties to Basra military units due to the insider threat identified via "uncle_mo."</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-1">•</span>
                                <span>Conduct accelerated checks on drivers, fixers, and guards for prison history or militia affiliation.</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="text-primary mt-1">•</span>
                                <span>Engage vetted host-nation security contacts for cross-verification of both usernames and any associated networks.</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                        
                        <div className="mt-4 p-3 rounded-md bg-orange-500/10 border border-orange-500/30">
                          <span className="font-semibold text-orange-500">Overall posture:</span>
                          <span className="text-foreground/90 ml-1">Move to heightened alert until both actors are either dormant or neutralised by authorities.</span>
                        </div>
                        
                        <div className="mt-6">
                          <BaghdadMovementMap />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground">{message.content}</p>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="rounded-lg border bg-background p-6">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Processing dark web query...</span>
                    </div>
                  </div>
                )}
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
                      placeholder="Continue investigation..."
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
      </main>
    </div>
  );
};

export default DarkWeb;
