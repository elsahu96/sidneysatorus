import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Globe, MessageSquare, AlertTriangle, ChevronDown, ChevronUp, Lightbulb } from "lucide-react";
import { useState } from "react";
import { LoadingStages } from "./LoadingStages";

interface DarkWebReportProps {
  loadingSection?: number;
  onFollowUpClick?: (prompt: string) => void;
}

export const DarkWebReport = ({ loadingSection = 10, onFollowUpClick }: DarkWebReportProps) => {
  const [showMethodology, setShowMethodology] = useState(false);

  const followUpPrompt1 = "Which neighbourhoods in East Baghdad show the highest convergence of threat signals from these actors?";
  const followUpPrompt2 = "What changes should we make to our NGO field movements or partner vetting in the next 72 hours based on these findings?";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Executive Summary */}
      {loadingSection >= 1 && (
        <Card className="p-8 border-2 border-primary/20 bg-gradient-to-br from-background via-background to-primary/5">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground mb-2">Executive Summary</h2>
              <p className="text-sm text-muted-foreground">BLUF (Bottom Line Up Front)</p>
            </div>
          </div>
          
          {loadingSection < 2 ? (
            <LoadingStages stages={["Analyzing threat data...", "Compiling executive summary..."]} />
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <span className="font-semibold text-foreground">Investigation objective: </span>
                <span className="text-foreground/90">Identify dangerous actors associated (directly or indirectly) with Asa'ib Ahl al-Haq (AAH) and assess the risk they pose to NGO staff operating in East Baghdad.</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Outcome: </span>
                <span className="text-foreground/90">Two hostile actor clusters identified from read-only dark-web analysis: (1) an active recruiter/arms seller calling volunteers to arms in East Baghdad, and (2) an ex-prisoner cell with extremist sympathies linked to elements of the Iraqi military. Both findings require immediate operational mitigation and legal escalation.</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Confidence: </span>
                <span className="text-foreground/90">Moderate for socio-digital sentiment and actor presence; Low-Moderate for attribution of specific criminal transactions until forensic corroboration is complete.</span>
              </div>
              <div>
                <span className="font-semibold text-foreground">Immediate recommendation: </span>
                <span className="text-foreground/90">Suspend high-visibility field activities in affected neighbourhoods, activate emergency liaison with host-nation security partners, and begin case handover to authorities with evidence packages (redacted as required).</span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Methodology Section */}
      {loadingSection >= 3 && (
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
      )}

      {/* Investigation Objectives */}
      {loadingSection >= 5 && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Investigation Objectives and Scope</h3>
          </div>
          
          {loadingSection < 6 ? (
            <LoadingStages stages={["Documenting investigation scope...", "Preparing objectives..."]} />
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <span className="font-semibold text-foreground">Primary objective: </span>
                <span className="text-foreground/90">Map, verify, and characterise dangerous individuals/groups whose rhetoric or activity directly increase risk to NGO staff in East Baghdad.</span>
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
          )}
        </Card>
      )}

      {/* Threat Actor 1 */}
      {loadingSection >= 7 && (
        <Card className="p-6 border-l-4 border-l-destructive">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-foreground mb-2">Threat Actor 1: AndreasRybak</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Handle:</span> <code className="ml-2 text-foreground font-mono">AndreasRybak</code></div>
                <div><span className="text-muted-foreground">Platform(s):</span> <span className="ml-2 text-foreground">Dark-web forum ("Darknetmarketnoobs")</span></div>
                <div><span className="text-muted-foreground">Language:</span> <span className="ml-2 text-foreground">English and Arabic (poorly translated - likely non-native)</span></div>
                <div><span className="text-muted-foreground">Geographic Focus:</span> <span className="ml-2 text-foreground">Iraq and Syria</span></div>
              </div>
            </div>
          </div>

          {loadingSection < 8 ? (
            <LoadingStages stages={["Analyzing first threat actor...", "Processing evidence..."]} />
          ) : (
            <>
              <div className="mt-4">
                <span className="font-semibold text-foreground block mb-2 text-sm">Discovery Method:</span>
                <p className="text-sm text-foreground/80">
                  Keyword search for Arabic terms مقاومة ("resistance/martyr") and عصائب أهل الحق ("volunteer") produced cross-referenced hits on indexed dark-web pages.
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-foreground/80 ml-2">
                  <li>مقاومة - Produced a hit on page 76</li>
                  <li>عصائب أهل الحق - Produced a hit on page 34</li>
                </ul>
              </div>

              <div className="mt-4">
                <span className="font-semibold text-foreground block mb-2 text-sm">Quotes of Interest:</span>
                <div className="space-y-3">
                  <div className="rounded-md bg-muted/30 p-3 border-l-2 border-primary/30">
                    <p className="text-sm text-foreground/90 italic mb-1">
                      "Get some followers together, arm up (either making your own arms or acquiring them from a trusted intermediary if you have one), and kill whoever it is that threatens you and the people in your group. The Taliban did this and were able to get popular support in post-Soviet Afghanistan because people were tired of little boys getting raped for Afghan elders' amusement and Mullah Omar and his students were hanging the rapists from the guns of rusted tanks. If you keep up the work and continue to build good relations with the people who appreciate your willingness to try and keep them safe, you might end up running the country one day. With all due respect, they're eventually going to try and kill you for being too 'moderate' and 'tolerant' a Muslim in their eyes. You might as well kill as many of them as you can before they try. Who knows? You might save the country."
                    </p>
                    <span className="text-xs text-muted-foreground">02/25</span>
                  </div>
                  <div className="rounded-md bg-muted/30 p-3 border-l-2 border-primary/30">
                    <p className="text-sm text-foreground/90 italic mb-1">
                      "Would be a good one. Was thinking more of getting people over and into the fray. There are thousands of volunteers who want to get involved."
                    </p>
                    <span className="text-xs text-muted-foreground">01/25</span>
                  </div>
                  <div className="rounded-md bg-muted/30 p-3 border-l-2 border-primary/30">
                    <p className="text-sm text-foreground/90 italic mb-1">
                      "I have RPG-7s sold on Telegram over in Iraq and Syria"
                    </p>
                    <span className="text-xs text-muted-foreground">10/24</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <span className="font-semibold text-foreground block mb-2 text-sm">Analysis:</span>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  Analysis indicates that AndreasRybak presents as a self-motivated violent extremist or arms facilitator operating across dark-web and Telegram ecosystems. His rhetoric combines ideological justification with operational intent, explicitly urging others to "arm up" and "kill whoever threatens your group," while invoking Taliban tactics as a model for local mobilisation. References to East Baghdad and the sale of "RPG-7s on Telegram over in Iraq and Syria" suggest proximity to existing militia markets and a functional understanding of cross-border arms flows. The language and timing of his posts align closely with AAH-adjacent resistance narratives, which glorify the defence of "the people" against internal and foreign enemies. While a direct command-and-control link to AAH cannot be confirmed, his discourse reinforces the group's propaganda ecosystem and could serve as an informal recruitment or facilitation node. From a threat perspective, his posts demonstrate both intent and capability - intent through repeated calls to violent action, and capability through claims of weapons access and recruitment outreach. For NGOs and humanitarian staff in East Baghdad, this represents a credible, near-term threat vector that could inspire or coordinate hostile acts.
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Threat Actor 2 */}
      {loadingSection >= 8 && (
        <Card className="p-6 border-l-4 border-l-orange-500">
          <div className="flex items-start gap-3 mb-4">
            <MessageSquare className="h-5 w-5 text-orange-500 mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-foreground mb-2">Threat Actor 2: uncle_mo</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Handle:</span> <code className="ml-2 text-foreground font-mono">uncle_mo</code></div>
                <div><span className="text-muted-foreground">Platform(s):</span> <span className="ml-2 text-foreground">Dark-web forum Dread / Various chats</span></div>
                <div><span className="text-muted-foreground">Language:</span> <span className="ml-2 text-foreground">English transliteration with regional phrasing</span></div>
                <div><span className="text-muted-foreground">Geographic Focus:</span> <span className="ml-2 text-foreground">Basra Governorate</span></div>
              </div>
            </div>
          </div>

          {loadingSection < 9 ? (
            <LoadingStages stages={["Analyzing second threat actor...", "Cross-referencing data..."]} />
          ) : (
            <>
              <div className="mt-4">
                <span className="font-semibold text-foreground block mb-2 text-sm">Discovery Method:</span>
                <p className="text-sm text-foreground/80">
                  Keyword search for فساد ("corruption") flagged thread discussing prison conditions in Basra, Iraq.
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-foreground/80 ml-2">
                  <li>فساد - Produced a hit on page 68</li>
                </ul>
              </div>

              <div className="mt-4">
                <span className="font-semibold text-foreground block mb-2 text-sm">Quotes of Interest:</span>
                <div className="space-y-3">
                  <div className="rounded-md bg-muted/30 p-3 border-l-2 border-primary/30">
                    <p className="text-sm text-foreground/90 italic mb-1">
                      "there's an active war in my area. No one gets in or out unless you work for the militia, that is what I had to do."
                    </p>
                    <span className="text-xs text-muted-foreground">03/25</span>
                  </div>
                  <div className="rounded-md bg-muted/30 p-3 border-l-2 border-primary/30">
                    <p className="text-sm text-foreground/90 italic mb-1">
                      "yes, dread was shut down for a few months. Ironically, i got involved in a legal trouble and while in prison i thought maybe authority seized it and got to know a lot of things going on in the dark"
                    </p>
                    <span className="text-xs text-muted-foreground">01/25</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <span className="font-semibold text-foreground block mb-2 text-sm">Analysis:</span>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  The user uncle_mo appears to belong to an emerging post-incarceration militant sub-network centred in Basra, a region with known militia penetration of formal security structures. His posts describe an environment in which "no one gets in or out unless you work for the militia," implying effective territorial control by armed groups and the coercive integration of civilians (particularly released inmates) into those networks. His reference to prison time and exposure to "a lot of things going on in the dark" suggests both insider knowledge of local corruption and normalisation of militant culture among ex-prisoners. While uncle_mo does not explicitly advocate violence, his narrative corroborates broader reporting of forced recruitment and ideological radicalisation within detention facilities feeding into PMF-aligned units, including those sympathetic to AAH. This raises a secondary but significant risk: infiltration of NGO operating environments by individuals with divided loyalties or extremist leanings, particularly through military liaisons, drivers, or local guards. The account's anonymity limits attribution, yet the linguistic and contextual consistency with verified Basra security trends lends the reporting moderate credibility. Taken together, the postings point to an insider-threat dimension rather than an external attack risk - underscoring the need for stricter partner vetting, closer coordination with vetted Iraqi security elements, and continuous monitoring for indicators of ideological leakage within local support networks.
                </p>
              </div>
            </>
          )}
        </Card>
      )}

      {/* Summary and Recommendations */}
      {loadingSection >= 9 && (
        <Card className="p-6 bg-gradient-to-br from-primary/5 to-background border-2 border-primary/20">
          <h3 className="text-xl font-semibold text-foreground mb-4">Summary and Recommendations</h3>
          
          {loadingSection < 10 ? (
            <LoadingStages stages={["Finalizing recommendations...", "Completing report..."]} />
          ) : (
            <div className="space-y-4 text-sm text-foreground/90 leading-relaxed">
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
          )}
        </Card>
      )}

      {/* Suggested Follow-up */}
      {loadingSection >= 10 && (
        <Card className="p-6 border border-primary/30 bg-primary/5">
          <div className="flex items-start gap-3 mb-4">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5" />
            <h3 className="text-lg font-semibold text-foreground">Suggested Follow-ups</h3>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => onFollowUpClick?.(followUpPrompt1)}
              className="w-full text-left p-4 rounded-lg border border-border bg-background hover:bg-muted/50 hover:border-primary/50 transition-all group"
            >
              <p className="text-sm text-foreground/90 group-hover:text-foreground">
                "{followUpPrompt1}"
              </p>
            </button>
            <button
              onClick={() => onFollowUpClick?.(followUpPrompt2)}
              className="w-full text-left p-4 rounded-lg border border-border bg-background hover:bg-muted/50 hover:border-primary/50 transition-all group"
            >
              <p className="text-sm text-foreground/90 group-hover:text-foreground">
                "{followUpPrompt2}"
              </p>
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};
