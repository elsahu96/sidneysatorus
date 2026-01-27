import { useState } from "react";
import { GlossaryTerm } from "@/components/GlossaryTerm";
import { Reference } from "@/components/Reference";
import { MaritimeVisualization } from "@/components/MaritimeVisualization";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookMarked, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

// Reference data with full metadata
const references = [
  {
    number: 1,
    username: "U.S. Treasury",
    date: "June 7, 2019",
    platform: "Treasury.gov",
    content: "Treasury Sanctions Iranian Petrochemical Group and Forty Entities - PGPIC and 39 subsidiaries sanctioned for providing material support to IRGC.",
    link: "https://home.treasury.gov/news/press-releases/sm703"
  },
  {
    number: 2,
    username: "OFAC",
    date: "2024",
    platform: "OFAC Advisory",
    content: "Maritime Advisory on Iranian Sanctions Evasion - Behavioral red flags and vessel tracking guidance for sanctions compliance.",
    link: "https://ofac.treasury.gov/media/934236/download"
  },
  {
    number: 3,
    username: "U.S. Treasury",
    date: "October 2024",
    platform: "Treasury.gov",
    content: "U.S. Actions Target Iranian Oil and Petrochemical Networks - Expansion of sanctions to shipping managers and storage terminals.",
    link: "https://home.treasury.gov/news/press-releases/jy2644"
  },
  {
    number: 4,
    username: "Reuters",
    date: "October 9, 2025",
    platform: "Reuters",
    content: "US imposes sanctions on China refinery over Iran oil - Chinese refinery and Malaysian logistics firm sanctioned for Iranian oil purchases.",
    link: "https://www.reuters.com/business/energy/us-imposes-sanctions-china-refinery-others-iran-oil-purchases-2025-10-09/"
  },
  {
    number: 5,
    username: "U.S. Treasury",
    date: "2022",
    platform: "Treasury.gov",
    content: "Treasury Targets Iranian Petroleum and Petrochemical Sales Network - Front trading entities across multiple jurisdictions.",
    link: "https://home.treasury.gov/news/press-releases/jy1128"
  },
  {
    number: 6,
    username: "OFAC",
    date: "2025",
    platform: "OFAC Advisory",
    content: "Maritime Guidance on AIS Manipulation and STS Transfers - Detection methods for dark fleet operations near high-risk zones.",
    link: "https://ofac.treasury.gov/media/31416/download?inline"
  },
  {
    number: 7,
    username: "GTReview",
    date: "2024",
    platform: "GTReview",
    content: "US accuses Malaysia, Singapore, UAE companies of breaching Iran sanctions - Regional hub sanctions enforcement actions.",
    link: "https://www.gtreview.com/news/global/us-accuses-malaysia-singapore-uae-companies-of-breaching-iran-sanctions/"
  },
  {
    number: 8,
    username: "U.S. Treasury",
    date: "June 2019",
    platform: "Treasury.gov",
    content: "PGPICC Marketing Activities in East Asia - Tens of millions in sales to Asian buyers through Dubai and Hong Kong brokers.",
    link: "https://home.treasury.gov/news/press-releases/sm700"
  },
  {
    number: 9,
    username: "U.S. Treasury",
    date: "2022",
    platform: "Treasury.gov",
    content: "Triliance Payment Clearing Networks - Offshore bank accounts and layered shell companies in Hong Kong and UAE.",
    link: "https://home.treasury.gov/news/press-releases/sm885"
  },
  {
    number: 10,
    username: "Lloyd's List",
    date: "2024",
    platform: "Lloyd's List Intelligence",
    content: "Over 50 shadow fleet ships spoofing off Malaysia's sanctioned oil transfer hub - Monthly tracking of AIS manipulation events.",
    link: "https://www.lloydslist.com/LL1154308/Over-50-shadow-fleet-ships-are-spoofing-off-Malaysia%E2%80%99s-sanctioned-oil-transfer-hub-monthly"
  },
  {
    number: 11,
    username: "OFAC",
    date: "2024",
    platform: "OFAC Release",
    content: "Iranian Cargo Re-documentation Practices - Blending and false origin certificates for Malaysian and Omani provenance claims.",
    link: "https://ofac.treasury.gov/media/933556/download"
  },
  {
    number: 12,
    username: "S&P Global",
    date: "October 9, 2025",
    platform: "S&P Commodity Insights",
    content: "US sanctions Chinese oil terminal, refinery in Iran crackdown - Expanded enforcement targeting downstream infrastructure.",
    link: "https://www.spglobal.com/commodity-insights/en/news-research/latest-news/crude-oil/100925-us-sanctions-chinese-oil-terminal-refinery-in-iran-crackdown"
  },
  {
    number: 13,
    username: "TankerTrackers",
    date: "September 2025",
    platform: "TankerTrackers",
    content: "Sanctioned Iranian Tanker Fleet - Real-time tracking of Iran-flagged vessels under U.S. sanctions with AIS disablement patterns.",
    link: "https://tankertrackers.com/report/sanctioned/results?flag=108"
  },
  {
    number: 14,
    username: "OpenSanctions",
    date: "2020",
    platform: "OpenSanctions",
    content: "Triliance Petrochemical Co. Ltd. Entity Profile - Designated January 2020 for facilitating hundreds of millions in Iranian petroleum sales.",
    link: "https://www.opensanctions.org/entities/NK-VbZh6BfXbeW8C7kHmyq8Rm/"
  },
  {
    number: 15,
    username: "OpenSanctions",
    date: "2020",
    platform: "OpenSanctions",
    content: "Triliance Affiliates Network - Associated fronts in Hong Kong, UAE, India, Malaysia, Singapore, and China.",
    link: "https://www.opensanctions.org/entities/NK-PRSL4tFHtourUqQDdwJWyb/"
  }
];

export const IranianPetrochemicalsReport = () => {
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  return (
    <div className="prose prose-invert max-w-none space-y-8">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Iranian Petrochemicals Sanctions-Evasion Network
            </h1>
            <p className="text-sm text-muted-foreground">
              Intelligence Assessment — Maritime Concealment & Broker Networks
            </p>
          </div>
          <Sheet open={referencesOpen} onOpenChange={setReferencesOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <BookMarked className="h-4 w-4" />
                References ({references.length})
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg bg-background">
              <SheetHeader>
                <SheetTitle>References</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-6 pr-4">
                <div className="space-y-4">
                  {references.map((ref) => (
                    <a
                      key={ref.number}
                      href={ref.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0 mt-0.5">
                          {ref.number}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">{ref.username}</p>
                              <p className="text-xs text-muted-foreground">{ref.date}</p>
                              <p className="text-xs text-muted-foreground">{ref.platform}</p>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                          </div>
                          <p className="text-sm text-foreground/90 leading-relaxed">{ref.content}</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Executive Summary */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Executive Summary (BLUF)
        </h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Finding</h3>
            <p className="text-base text-foreground/90 leading-relaxed">
              Multiple public designations show <GlossaryTerm term="PGPIC" definition="Persian Gulf Petrochemical Industries Company - Controls approximately 40% of Iran's petrochemical capacity and 50% of exports" /> and Triliance at the core of networks selling Iranian petrochemicals offshore using front entities and deceptive maritime practices. These practices include <GlossaryTerm term="AIS manipulation" definition="Automatic Identification System manipulation - The deliberate disabling or falsifying of vessel tracking data to conceal movements" /> and ship-to-ship (STS) transfers before delivery to Asia.<Reference {...references[0]} />
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Risk</h3>
            <p className="text-base text-foreground/90 leading-relaxed">
              Importers, traders, terminals, and insurers face secondary-sanctions exposure and operational risk if they touch cargoes linked to these networks. Recent advisories elevate behavioural red flags (AIS gaps, flag-hopping, opaque ownership) to the same weight as entity screening.<Reference {...references[1]} />
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Impact</h3>
            <p className="text-base text-foreground/90 leading-relaxed">
              Disruption risk is material: U.S. actions in 2024-2025 targeted dozens of firms, vessels, and even terminals tied to Iranian flows (oil & petrochem), expanding the circle of liability for buyers, logistics nodes, and service providers.<Reference {...references[2]} /><Reference {...references[3]} />
            </p>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <div className="space-y-4">
        <button
          onClick={() => setShowMethodology(!showMethodology)}
          className="flex items-center justify-between w-full text-left group rounded-lg border border-border bg-card/50 p-4 hover:bg-card transition-colors"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-foreground">Methodology</h2>
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
          <div className="space-y-6 bg-card/50 border border-border/50 rounded-lg p-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">1. Pick seed entities & keywords</h3>
              <div className="ml-4 space-y-2 text-base text-foreground/90">
                <p><span className="font-semibold text-primary">Entities:</span> PGPIC, PGPICC, Triliance and known front names from OFAC.</p>
                <p><span className="font-semibold text-primary">Keywords:</span> methanol, urea, BTX, "ship-to-ship", "AIS dark", Bandar Imam Khomeini, Assaluyeh, Fujairah, Johor, Dalian.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">2. Collect primary official records</h3>
              <p className="ml-4 text-base text-foreground/90 leading-relaxed">
                Downloaded OFAC/Treasury designation notices and maritime advisories (in source list).
                Record dates, exact names/aliases, and annexe lists of affiliates.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">3. Gather maritime movement evidence</h3>
              <p className="ml-4 text-base text-foreground/90 leading-relaxed">
                Pulled AIS/maritime analytics and visualisations (TankerTrackers, MarineTraffic, Lloyd's List Intelligence).
                Export voyage tracks showing AIS gaps.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">4. Search trade and media reporting</h3>
              <p className="ml-4 text-base text-foreground/90 leading-relaxed">
                Collected relevant Reuters, S&P Global, Lloyd's List, and investigative pieces that reference the same actors or routes.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">5. Build the network</h3>
              <p className="ml-4 text-base text-foreground/90 leading-relaxed">
                Created a simple process list: (seller/front trader/vessel/STS location/receiving terminal) based each on the original source (OFAC press release, AIS screenshot, Reuters story).
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">6. Analyst assessment</h3>
              <p className="ml-4 text-base text-foreground/90 leading-relaxed">
                Wrote a short narrative linking the evidence to the investigation, highlight gaps and alternative explanations.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Company Identifiers */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Company Identifiers (for screening & drafting)
        </h2>

        <div className="space-y-4 bg-card/50 border border-border rounded-lg p-6">
          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">PGPIC</h3>
            <p className="text-base text-foreground/90 leading-relaxed">
              Persian Gulf Petrochemical Industries Company, designated 7 Jun 2019, with 39 subsidiaries and foreign-based sales agents. OFAC notes PGPIC's group holds approximately 40% of Iran's petrochemical capacity and approximately 50% of exports.<Reference {...references[0]} />
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">PGPICC</h3>
            <p className="text-base text-foreground/90 leading-relaxed">
              Petrochemical Commercial Company (commercial arm of PGPIC); repeatedly cited for sales to East Asia via intermediaries.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-primary mb-2">Triliance Petrochemical Co. Ltd.</h3>
            <p className="text-base text-foreground/90 leading-relaxed">
              Designated 23 Jan 2020 for facilitating hundreds of millions of USD in petroleum/petrochemical sales on behalf of NIOC, later waves add associated fronts in HK/UAE/India/Malaysia/Singapore/PRC.<Reference {...references[0]} />
            </p>
          </div>
        </div>
      </section>

      {/* Findings & Analysis */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Findings & Analysis
        </h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              1. PGPIC and its subsidiaries anchor the upstream supply chain
            </h3>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              The Persian Gulf Petrochemical Industries Company (PGPIC) and its commercial arm PGPICC control roughly 40% of Iran's petrochemical output.
            </p>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              In June 2019, the U.S. Treasury sanctioned PGPIC and 39 subsidiaries and agents for providing material support to the <GlossaryTerm term="IRGC" definition="Islamic Revolutionary Guard Corps - A branch of Iran's military designated as a Foreign Terrorist Organization by the U.S." />.
            </p>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              Subsequent releases in 2022 and 2024 cited PGPICC's role in marketing and selling products worth tens of millions of dollars to East Asian buyers, typically through brokers in Dubai, Sharjah, and Hong Kong.<Reference {...references[7]} />
            </p>
            <div className="bg-card/50 border border-border rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold text-foreground mb-2">Key upstream locations:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-foreground/90">
                <li>Bandar Imam Khomeini and Assaluyeh (major petrochemical export terminals)</li>
                <li>Tehran (corporate headquarters)</li>
                <li>Commercial intermediaries in Dubai DMCC, Sharjah FZE zones, and Hong Kong corporate registries</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              2. Triliance Petrochemical operates as the primary broker
            </h3>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              Triliance Petrochemical Co. Ltd, headquartered in Tehran with trading offices in Hong Kong and the UAE, was sanctioned in January 2020 for brokering sales of Iranian petroleum and petrochemical products valued in the hundreds of millions of dollars.<Reference {...references[13]} /><Reference {...references[14]} />
            </p>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              Later actions in 2022 and 2023 identified Triliance affiliates in China, India, Malaysia, and Singapore for continuing to facilitate exports on behalf of Iranian producers despite sanctions.<Reference {...references[9]} />
            </p>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              Triliance appears repeatedly in trade data and maritime investigations as the contractual seller or financing agent for Iranian methanol, urea, and aromatics shipments.
            </p>
            <p className="text-base text-foreground/90 leading-relaxed">
              Payments are often cleared through offshore bank accounts registered in Hong Kong or the UAE using layered shell companies.<Reference {...references[8]} />
            </p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              3. Deceptive shipping practices enable the movement
            </h3>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              Multiple investigations show that sanctioned cargoes are moved through a <GlossaryTerm term="shadow fleet" definition="Network of vessels operating outside international regulations, often with obscured ownership, used to evade sanctions" /> of re-flagged tankers conducting STS transfers in international waters.
            </p>
            <div className="bg-card/50 border border-border rounded-lg p-4 mb-3">
              <p className="text-sm font-semibold text-foreground mb-2">Observed behaviours:</p>
              <ul className="list-disc list-inside space-y-2 text-sm text-foreground/90">
                <li>AIS disablement ("going dark") during transit from Bandar Imam Khomeini or Assaluyeh to the Gulf of Oman.<Reference {...references[12]} /></li>
                <li>STS transfers near Fujairah (UAE), off Johor (Malaysia), and the South China Sea.<Reference {...references[9]} /></li>
                <li>Blending and re-documentation to declare cargoes as originating in Malaysia or Oman before final delivery to China (Dalian, Ningbo) or Vietnam.<Reference {...references[10]} /></li>
              </ul>
            </div>
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <p className="text-sm font-semibold text-primary mb-2">⚠️ Analyst flag:</p>
              <p className="text-sm text-foreground/90">
                Any petrochemical cargo routed through Malaysia or Singapore with documentation inconsistent with its voyage path should be treated as high-risk for Iranian origin.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-foreground mb-3">
              4. Expansion of enforcement and secondary exposure
            </h3>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              By 2024-2025, OFAC had moved beyond sanctioning producers and brokers to naming specific vessels, shipping managers, and storage terminals.
            </p>
            <p className="text-base text-foreground/90 leading-relaxed mb-3">
              One tranche (October 2025) included a Chinese refinery and a Malaysian logistics firm for purchasing or facilitating Iranian oil and petrochemical products.<Reference {...references[11]} />
            </p>
            <p className="text-base text-foreground/90 leading-relaxed">
              This marks a policy shift: liability now extends to entities that "knew or should have known" of Iranian origin, even when the original producer is several tiers removed.<Reference {...references[3]} />
            </p>
          </div>
        </div>
      </section>

      {/* Supply Chain Flow */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Illustrative supply-chain flow (simplified)
        </h2>
        <div className="bg-card/50 border border-border rounded-lg p-6">
          <ol className="space-y-3 text-base text-foreground/90">
            <li className="flex gap-3">
              <span className="font-semibold text-primary shrink-0">1.</span>
              <span>PGPIC / Triliance (Iran)</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary shrink-0">2.</span>
              <span>Sale to front trading entities (multiple jurisdictions)<Reference {...references[4]} /></span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary shrink-0">3.</span>
              <span>Load on shadow fleet tanker</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary shrink-0">4.</span>
              <span>AIS dark + STS near high-risk zones<Reference {...references[5]} /></span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary shrink-0">5.</span>
              <span>Discharge at Asian terminal/refinery<Reference {...references[6]} /></span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary shrink-0">6.</span>
              <span>Blend/re-document</span>
            </li>
            <li className="flex gap-3">
              <span className="font-semibold text-primary shrink-0">7.</span>
              <span>Sale to downstream buyers (sometimes via third-country subsidiaries)</span>
            </li>
          </ol>
        </div>
      </section>

      {/* Maritime Visualization */}
      <MaritimeVisualization />

      {/* Sanctioned Vessels */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Related sanctioned vessels to watch out for
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border border-border rounded-lg overflow-hidden">
            <thead className="bg-card/80">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground border-b border-border">Name / IMO NO</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground border-b border-border">Built</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground border-b border-border">Class</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground border-b border-border">Flag</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-foreground border-b border-border">Sanction Date</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-sm text-foreground/90">AMBER (9357406)</td>
                <td className="px-4 py-3 text-sm text-foreground/90">2008</td>
                <td className="px-4 py-3 text-sm text-foreground/90">VLCC / ULCC</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Iran</td>
                <td className="px-4 py-3 text-sm text-foreground/90">8 May 2025</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-sm text-foreground/90">AMINA (9305192)</td>
                <td className="px-4 py-3 text-sm text-foreground/90">2005</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Panamax</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Iran</td>
                <td className="px-4 py-3 text-sm text-foreground/90">8 May 2025</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-sm text-foreground/90">APAMA (9187631)</td>
                <td className="px-4 py-3 text-sm text-foreground/90">2000</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Aframax</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Iran</td>
                <td className="px-4 py-3 text-sm text-foreground/90">8 May 2025</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-sm text-foreground/90">DARYA DELVAR (9302426)</td>
                <td className="px-4 py-3 text-sm text-foreground/90">2005</td>
                <td className="px-4 py-3 text-sm text-foreground/90">VLCC</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Iran</td>
                <td className="px-4 py-3 text-sm text-foreground/90">8 May 2025</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-4 py-3 text-sm text-foreground/90">SABALAN (9187655)</td>
                <td className="px-4 py-3 text-sm text-foreground/90">2000</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Aframax</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Iran</td>
                <td className="px-4 py-3 text-sm text-foreground/90">8 May 2025</td>
              </tr>
              <tr>
                <td className="px-4 py-3 text-sm text-foreground/90">SHAHID BAGHERI (IRGC-N) (9209350)</td>
                <td className="px-4 py-3 text-sm text-foreground/90">2023</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Handymax / military-linked</td>
                <td className="px-4 py-3 text-sm text-foreground/90">Iran</td>
                <td className="px-4 py-3 text-sm text-foreground/90">8 May 2025</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Conclusion */}
      <section>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Conclusion
        </h2>
        <div className="space-y-4 text-base text-foreground/90 leading-relaxed">
          <p>
            Open-source evidence confirms that Iran's petrochemical export network remains operational, adaptive, and heavily dependent on concealment techniques designed to outpace sanctions enforcement. The nexus between PGPIC, its commercial arm PGPICC, and broker networks such as Triliance Petrochemical Co. Ltd. continues to underpin the offshore sales architecture supplying Asian buyers through third-country intermediaries.
          </p>
          <p>
            The integration of maritime data from TankerTrackers, Lloyd's List Intelligence, and OFAC advisories (2024-2025) establishes a direct behavioural pattern linking sanctioned cargoes to a fleet of Iran-flagged tankers, including vessels such as AMBER (IMO 9357406), APAMA (9187631), and SABALAN (9187655), which repeatedly demonstrate AIS disablement and ship-to-ship transfers near Fujairah, Johor, and the South China Sea. These tankers form part of what enforcement agencies now label Iran's "dark fleet"—a logistics ecosystem built specifically to move sanctioned petroleum and petrochemical products under false provenance.
          </p>
          <p>
            This behaviour is no longer speculative; it is quantitatively documented in regulatory releases, maritime analytics, and satellite-based observation. OFAC's 2025 Maritime Advisory explicitly cites STS off Malaysia and AIS suppression as indicators of Iranian origin cargo, while Lloyd's List tracks over fifty spoofing events per month in the same zone. The TankerTrackers dataset reinforces that pattern, listing more than a dozen Iranian-flagged tankers operating under sanctions as of September 2025.
          </p>
          <p>
            For traders, insurers, and terminals, the practical takeaway is clear: entity screening alone is no longer sufficient. Risk now resides in voyage behaviour and cargo documentation as much as in name lists.
          </p>
          <p className="font-semibold text-primary">
            Any cargo routed through Malaysia or Singapore with incomplete AIS history, inconsistent certificates of origin, or links to recently sanctioned Iranian vessels should be treated as high-risk for sanctions exposure and reputational damage.
          </p>
          <p>
            In sum, Iran's petrochemical supply chain has evolved from a linear export model into a distributed evasion network, blending legal and illicit channels through layered ownership, maritime opacity, and strategic geography.
          </p>
          <p className="font-semibold">
            Effective mitigation now requires continuous monitoring of vessel behaviour, payment pathways, and documentation anomalies across every stage of the supply chain, from Bandar Imam Khomeini to the final berth in East Asia.
          </p>
        </div>
      </section>

      {/* Metadata */}
      <div className="pt-6 border-t border-border text-xs text-muted-foreground">
        <p>Report compiled: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    </div>
  );
};
