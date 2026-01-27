import { useState } from "react";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Reference } from "./Reference";
import { GlossaryTerm } from "./GlossaryTerm";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { BookMarked, ExternalLink } from "lucide-react";

// Reference data structure
const references = [
  {
    number: 1,
    username: "ECFR",
    date: "2024",
    platform: "Policy Brief",
    content: "Analysis of PLA military drills around Taiwan emphasizing blockade capabilities",
    link: "https://ecfr.eu/publication/strait-talking-whats-behind-chinas-military-drills-around-taiwan"
  },
  {
    number: 2,
    username: "The Straits Times",
    date: "2024",
    platform: "News",
    content: "Taiwan must be allowed equal participation when China hosts APEC",
    link: "https://www.straitstimes.com/asia/east-asia/taiwan-must-be-allowed-equal-participation-when-china-hosts-apec-us-says"
  },
  {
    number: 3,
    username: "Al Jazeera",
    date: "2025",
    platform: "News",
    content: "Taiwan opposition elects new leader who wants peace with China",
    link: "https://www.aljazeera.com/news/2025/10/19/taiwan-opposition-elects-new-leader-who-wants-peace-with-china"
  },
  {
    number: 4,
    username: "Korea Times",
    date: "2024",
    platform: "News",
    content: "Japan protests at Chinese diplomat threat over PM's Taiwan comments",
    link: "https://www.koreatimes.co.kr/www/nation/2024/10/120_387412.html"
  },
  {
    number: 5,
    username: "Taiwan DGBAS",
    date: "2024",
    platform: "Government Statistics",
    content: "National Statistics outline and economic indicators",
    link: "https://eng.stat.gov.tw/np.asp?ctNode=2268"
  },
  {
    number: 6,
    username: "Reuters",
    date: "2024",
    platform: "News",
    content: "EU approves German state aid for $11 billion TSMC chip plant",
    link: "https://www.reuters.com/technology/eu-approves-german-state-aid-11-billion-tsmc-chip-plant-2024-06-24/"
  },
  {
    number: 7,
    username: "Mainichi Shimbun",
    date: "2024",
    platform: "News",
    content: "Taiwan semiconductor industry developments in Japan",
    link: "https://mainichi.jp/english/search?q=taiwan"
  },
  {
    number: 8,
    username: "TSMC",
    date: "2024",
    platform: "Corporate",
    content: "TSMC Fabs overview and locations",
    link: "https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs"
  },
  {
    number: 9,
    username: "ECFR",
    date: "2024",
    platform: "Policy Brief",
    content: "Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario",
    link: "https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario"
  },
  {
    number: 10,
    username: "Taiwan News",
    date: "2024",
    platform: "News",
    content: "Samsung's foundry customers could turn to Taiwan's TSMC",
    link: "https://www.taiwannews.com.tw/news/5995865"
  },
  {
    number: 11,
    username: "Reuters",
    date: "2024",
    platform: "News",
    content: "US targets Chinese companies over drone components used by Hamas, Houthis",
    link: "https://www.reuters.com/world/us/us-sanctions-chinese-companies-over-drone-components-used-by-hamas-houthis-2024-09-12/"
  },
  {
    number: 12,
    username: "The Diplomat",
    date: "2024",
    platform: "Analysis",
    content: "Taiwan's T-Dome Missile Defense: Balancing Deterrence, Risk, and Regional Stability",
    link: "https://thediplomat.com/2024/10/taiwans-t-dome-missile-defense-balancing-deterrence-risk-and-regional-stability/"
  },
  {
    number: 13,
    username: "CommonWealth Magazine",
    date: "2025",
    platform: "Analysis",
    content: "After Taiwan's Mass Recall Fails, What's Next for the DPP?",
    link: "https://english.cw.com.tw/article/article.action?id=3909"
  },
  {
    number: 14,
    username: "Taiwan DBAS",
    date: "2024",
    platform: "Government Statistics",
    content: "Department of Budget, Accounting and Statistics data",
    link: "https://eng.dgbas.gov.tw/np.asp?ctNode=2265"
  },
  {
    number: 15,
    username: "SIA",
    date: "2025",
    platform: "Industry Report",
    content: "Semiconductor Industry Association State of the Industry Report 2025",
    link: "https://www.semiconductors.org/wp-content/uploads/2025/05/SIA-State-of-the-Industry-Report-2025.pdf"
  }
];

const glossary: Record<string, string> = {
  "Cross-Strait": "Refers to the Taiwan Strait - shorthand for relations and tensions between the People's Republic of China (PRC) and Taiwan (Republic of China).",
  "PLA": "People's Liberation Army - China's armed forces, responsible for military operations near Taiwan.",
  "Blockade/Anti-Access": "Military strategies aimed at isolating Taiwan by disrupting air, sea, and communications routes without a full invasion.",
  "Grey-zone": "Coercive actions below the threshold of open warfare (e.g., cyberattacks, airspace incursions, disinformation, cable sabotage).",
  "NOTAM": "Notice to Air Missions - alerts that identify restricted airspace during exercises.",
  "FIR": "Flight Information Region - designated airspace area for which a country manages air traffic.",
  "DPP": "Democratic Progressive Party (currently holds the presidency).",
  "KMT": "Kuomintang (main opposition).",
  "TPP": "Taiwan People's Party (centrist, emerging power-broker).",
  "GDP": "Gross Domestic Product - total value of goods and services produced.",
  "CPI": "Consumer Price Index - a measure of inflation.",
  "DGBAS": "Taiwan's Directorate-General of Budget, Accounting and Statistics - national source for economic data.",
  "EU Chips Act": "European Union legislation funding domestic semiconductor capacity and supply chain security.",
  "TSMC": "Taiwan Semiconductor Manufacturing Company - the world's largest contract chipmaker.",
  "ESMC": "European Semiconductor Manufacturing Company - the new TSMC-led fab in Dresden, Germany (TSMC 70%, Bosch/Infineon/NXP 10% each).",
  "JASM": "Japan Advanced Semiconductor Manufacturing - TSMC's joint venture fab in Kumamoto, Japan.",
  "OSAT": "Outsourced Semiconductor Assembly and Test - packaging and testing providers downstream from wafer fabrication.",
  "HBM": "High Bandwidth Memory - a type of advanced memory chip used in AI and high-performance computing.",
  "DRAM": "Dynamic Random Access Memory - volatile memory used in PCs and industrial electronics.",
  "ASIC": "Application-Specific Integrated Circuit - custom-designed chip used in specific applications like automotive sensors.",
  "N28": "Semiconductor process node (28nm) - mature node widely used in automotive and industrial components.",
  "N40": "Semiconductor process node (40nm) - mature node widely used in automotive and industrial components.",
  "Node Portability": "The ability to transfer a chip design to a different fabrication process or foundry.",
  "DFM": "Design for Manufacturability - engineering practice ensuring designs can be fabricated efficiently.",
  "Hsinchu": "Major science park in Taiwan where leading fabs are located.",
  "Tainan": "Major science park in Taiwan where leading fabs are located.",
  "Kumamoto": "City in Japan hosting the JASM fab.",
  "Dresden": "City in Germany hosting the ESMC fab.",
  "Munich": "TSMC's European Design Centre - aids chip design and client engagement.",
  "Tier 1": "A direct supplier to major manufacturers (in this case, automotive OEMs).",
  "OEM": "Original Equipment Manufacturer - companies like BMW, Volkswagen, etc.",
  "BOM": "Bill of Materials - list of parts and components required to build a product.",
  "Allocation Contract": "Supply agreement guaranteeing volume/reservation during constrained capacity periods.",
  "Force-majeure": "Contractual provision allowing flexibility in logistics or delivery during limited disruptions (e.g PLA drills).",
  "Buffer Stock": "Safety inventory held to mitigate supply disruptions."
};

const G = ({ children }: { children: string }) => {
  const term = glossary[children];
  if (!term) return <span className="font-semibold">{children}</span>;
  return <GlossaryTerm term={children} definition={term} />;
};

export const TaiwanReport = () => {
  const [referencesOpen, setReferencesOpen] = useState(false);

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between border-b border-[hsl(var(--report-border))] pb-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-[hsl(var(--report-text))]">
            Taiwan Risk & Semiconductor Report
          </h1>
          <p className="text-lg text-[hsl(var(--report-text-secondary))]">
            For TechForward Solutions
          </p>
        </div>
        <Sheet open={referencesOpen} onOpenChange={setReferencesOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))] shrink-0">
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
                    className="block p-4 rounded-lg border border-[hsl(var(--report-border))] bg-[hsl(var(--report-highlight))] hover:bg-[hsl(var(--info-bg))] transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold shrink-0 mt-0.5">
                        {ref.number}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">@{ref.username}</p>
                            <p className="text-xs text-[hsl(var(--report-text-secondary))]">{ref.date}</p>
                            <p className="text-xs text-[hsl(var(--report-text-secondary))]">{ref.platform}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-[hsl(var(--report-text-secondary))] group-hover:text-foreground transition-colors shrink-0" />
                        </div>
                        <p className="text-sm text-[hsl(var(--report-text))] leading-relaxed">{ref.content}</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      <Card className="bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))]">
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Executive Summary (BLUF)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
            <G>Cross-Strait</G> risk remains elevated but short of war; <G>PLA</G> drills emphasise <G>Blockade/Anti-Access</G>, not immediate invasion
            <Reference number={1} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of PLA military drills around Taiwan emphasizing blockade capabilities" link="https://ecfr.eu/publication/strait-talking-whats-behind-chinas-military-drills-around-taiwan" />
            . Expect periodic disruptions to air/sea lanes and insurance premiums rather than "day one" kinetic loss
            <Reference number={2} username="The Straits Times" date="2024" platform="News" content="Taiwan must be allowed equal participation when China hosts APEC" link="https://www.straitstimes.com/asia/east-asia/taiwan-must-be-allowed-equal-participation-when-china-hosts-apec-us-says" />
            .
          </p>
          <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
            Domestic gridlock in Taipei persists (<G>DPP</G> presidency, <G>KMT</G>/<G>TPP</G> influence in the legislature), constraining big policy shifts but sustaining defence spending and resilience measures
            <Reference number={3} username="Al Jazeera" date="2025" platform="News" content="Taiwan opposition elects new leader who wants peace with China" link="https://www.aljazeera.com/news/2025/10/19/taiwan-opposition-elects-new-leader-who-wants-peace-with-china" />
            . Semiconductor supply is tightening in 2025–26 on AI demand (<G>HBM</G>/logic), with South Korea surging
            <Reference number={4} username="Korea Times" date="2024" platform="News" content="Japan protests at Chinese diplomat threat over PM's Taiwan comments" link="https://www.koreatimes.co.kr/www/nation/2024/10/120_387412.html" />
            ; Taiwan's macro backdrop is strong and inflation subdued
            <Reference number={5} username="Taiwan DGBAS" date="2024" platform="Government Statistics" content="National Statistics outline and economic indicators" link="https://eng.stat.gov.tw/np.asp?ctNode=2268" />
            . Availability (not price) is the constraint.
          </p>
          <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
            Geographic hedges are materialising, but near-term European capacity arrives in 2027
            <Reference number={6} username="Reuters" date="2024" platform="News" content="EU approves German state aid for $11 billion TSMC chip plant" link="https://www.reuters.com/technology/eu-approves-german-state-aid-11-billion-tsmc-chip-plant-2024-06-24/" />
            , Japan's ramp is underway but uneven
            <Reference number={7} username="Mainichi Shimbun" date="2024" platform="News" content="Taiwan semiconductor industry developments in Japan" link="https://mainichi.jp/english/search?q=taiwan" />
            . Plan on 24–36 months before a meaningful non-Taiwan fallback for automotive nodes
            <Reference number={8} username="TSMC" date="2024" platform="Corporate" content="TSMC Fabs overview and locations" link="https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs" />
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Key Judgments
            <Badge variant="outline" className="ml-3 text-sm">
              with Confidence Ratings
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="shrink-0 bg-[hsl(var(--info-bg))] text-[hsl(var(--report-text))] border-[hsl(var(--info-border))]">
                Medium-High Confidence
              </Badge>
            </div>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              <G>Cross-Strait</G> coercion will continue below the threshold of war, producing episodic logistics/insurance disruptions rather than an immediate kinetic halt to chips in the next 6–12 months
              <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
              (pattern of <G>PLA</G> blockade-style drills, civil aviation route moves, subsea cable harassment).
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="shrink-0 bg-[hsl(var(--info-bg))] text-[hsl(var(--report-text))] border-[hsl(var(--info-border))]">
                High Confidence
              </Badge>
            </div>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Taiwan's political split (Lai presidency/opposition-leaning legislature) will blunt radical policy moves but maintain defence/industrial resilience spending
              <Reference number={3} username="Al Jazeera" date="2025" platform="News" content="Taiwan opposition elects new leader who wants peace with China" link="https://www.aljazeera.com/news/2025/10/19/taiwan-opposition-elects-new-leader-who-wants-peace-with-china" />
              .
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="shrink-0 bg-[hsl(var(--info-bg))] text-[hsl(var(--report-text))] border-[hsl(var(--info-border))]">
                High Confidence
              </Badge>
            </div>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Global AI demand will crowd foundry/packaging capacity through 2026; South Korea (Samsung/SK hynix) is structurally advantaged in memory/<G>HBM</G>, with lead times tight
              <Reference number={4} username="Korea Times" date="2024" platform="News" content="Japan protests at Chinese diplomat threat over PM's Taiwan comments" link="https://www.koreatimes.co.kr/www/nation/2024/10/120_387412.html" />
              <Reference number={10} username="Taiwan News" date="2024" platform="News" content="Samsung's foundry customers could turn to Taiwan's TSMC" link="https://www.taiwannews.com.tw/news/5995865" />
              .
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="shrink-0 bg-[hsl(var(--info-bg))] text-[hsl(var(--report-text))] border-[hsl(var(--info-border))]">
                Medium Confidence
              </Badge>
            </div>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Non-Taiwan hedges are real but late: <G>ESMC</G> <G>Dresden</G> target production 2027; Japan expansion progressing, but timelines have fluctuated
              <Reference number={6} username="Reuters" date="2024" platform="News" content="EU approves German state aid for $11 billion TSMC chip plant" link="https://www.reuters.com/technology/eu-approves-german-state-aid-11-billion-tsmc-chip-plant-2024-06-24/" />
              <Reference number={7} username="Mainichi Shimbun" date="2024" platform="News" content="Taiwan semiconductor industry developments in Japan" link="https://mainichi.jp/english/search?q=taiwan" />
              .
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="shrink-0 bg-[hsl(var(--info-bg))] text-[hsl(var(--report-text))] border-[hsl(var(--info-border))]">
                Medium Confidence
              </Badge>
            </div>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Earthquake and water stress remain hard risks to Taiwan fabs; engineered mitigations reduce, but do not eliminate, single-point failures
              <Reference number={11} username="Reuters" date="2024" platform="News" content="US targets Chinese companies over drone components used by Hamas, Houthis" link="https://www.reuters.com/world/us/us-sanctions-chinese-companies-over-drone-components-used-by-hamas-houthis-2024-09-12/" />
              <Reference number={12} username="The Diplomat" date="2024" platform="Analysis" content="Taiwan's T-Dome Missile Defense: Balancing Deterrence, Risk, and Regional Stability" link="https://thediplomat.com/2024/10/taiwans-t-dome-missile-defense-balancing-deterrence-risk-and-regional-stability/" />
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Context: Political & Economic Background
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Politics</h3>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              January 2024 elections yielded no legislative majority; <G>KMT</G> became the largest party, and <G>DPP</G> retained the presidency (Lai Ching-te). Large <G>KMT</G> lawmaker recall bids failed in July 2025, preserving gridlock
              <Reference number={13} username="CommonWealth Magazine" date="2025" platform="Analysis" content="After Taiwan's Mass Recall Fails, What's Next for the DPP?" link="https://english.cw.com.tw/article/article.action?id=3909" />
              .
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Security Environment</h3>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              <G>PLA</G> drills in 2025 emphasised blockade/anti-access profiles; Beijing also altered air routes (e.g., W121/M503 link), complicating Taiwan <G>FIR</G> management. Sub-threshold pressure includes risks to subsea cables
              <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
              .
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Macro</h3>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Taiwan growth upgraded on tech exports, <G>CPI</G> subdued near/below 2% in 2025. Net: a robust tech cycle with manageable inflation
              <Reference number={5} username="Taiwan DGBAS" date="2024" platform="Government Statistics" content="National Statistics outline and economic indicators" link="https://eng.stat.gov.tw/np.asp?ctNode=2268" />
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">Analysis by Theme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">a) Domestic Politics</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>Divided government limits major domestic overhauls but sustains bipartisan incentives on defence, supply chain resilience, and energy security. Expect incrementalism
                <Reference number={3} username="Al Jazeera" date="2025" platform="News" content="Taiwan opposition elects new leader who wants peace with China" link="https://www.aljazeera.com/news/2025/10/19/taiwan-opposition-elects-new-leader-who-wants-peace-with-china" />
                .</li>
              <li>Legislative recalls failed to shift power, reinforcing policy continuity and signalling voter fatigue with procedural brinkmanship
                <Reference number={13} username="CommonWealth Magazine" date="2025" platform="Analysis" content="After Taiwan's Mass Recall Fails, What's Next for the DPP?" link="https://english.cw.com.tw/article/article.action?id=3909" />
                .</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">b) Foreign Policy</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>PRC pressure continues via exercises, civil aviation route changes (W121/M503), and <G>Grey-zone</G> activities (offshore islands, critical infrastructure). Insurance classes and freight rates remain sensitive to exercise windows
                <Reference number={1} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of PLA military drills around Taiwan emphasizing blockade capabilities" link="https://ecfr.eu/publication/strait-talking-whats-behind-chinas-military-drills-around-taiwan" />
                <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
                .</li>
              <li>Allied responses: Taiwan has lengthened its Han Kuang drills; U.S./EU coordination on supply-chain resilience and the implementation of the Chips Act is proceeding
                <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
                .</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">c) Economic Development</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>Growth: Taiwan plans higher 2025 growth forecasts on AI-linked exports; inflation soft. This supports state capacity for resilience/defence spending and fab infrastructure
                <Reference number={5} username="Taiwan DGBAS" date="2024" platform="Government Statistics" content="National Statistics outline and economic indicators" link="https://eng.stat.gov.tw/np.asp?ctNode=2268" />
                <Reference number={14} username="Taiwan DBAS" date="2024" platform="Government Statistics" content="Department of Budget, Accounting and Statistics data" link="https://eng.dgbas.gov.tw/np.asp?ctNode=2265" />
                .</li>
              <li>Shock memory: The April 2024 quake forced temporary fab evacuations with limited critical tool damage, underscoring the tail risk to advanced nodes and packaging
                <Reference number={11} username="Reuters" date="2024" platform="News" content="US targets Chinese companies over drone components used by Hamas, Houthis" link="https://www.reuters.com/world/us/us-sanctions-chinese-companies-over-drone-components-used-by-hamas-houthis-2024-09-12/" />
                .</li>
              <li>Structural resource risks: Past droughts demonstrate the water dependency of fabs, and mitigations (such as water trucks and recycling) help but do not entirely neutralise the risk
                <Reference number={12} username="The Diplomat" date="2024" platform="Analysis" content="Taiwan's T-Dome Missile Defense: Balancing Deterrence, Risk, and Regional Stability" link="https://thediplomat.com/2024/10/taiwans-t-dome-missile-defense-balancing-deterrence-risk-and-regional-stability/" />
                .</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">d) Semiconductor Sector</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>Taiwan today: <G>TSMC</G> is still the indispensable logic node provider; packaging is also tight. Near-term supply risk is schedule/insurance volatility, unlikely to collapse
                <Reference number={8} username="TSMC" date="2024" platform="Corporate" content="TSMC Fabs overview and locations" link="https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs" />
                <Reference number={2} username="The Straits Times" date="2024" platform="News" content="Taiwan must be allowed equal participation when China hosts APEC" link="https://www.straitstimes.com/asia/east-asia/taiwan-must-be-allowed-equal-participation-when-china-hosts-apec-us-says" />
                .</li>
              <li>Japan: <G>JASM</G> (<G>Kumamoto</G>) phase-1 is live, phase-2 construction began in 2025, but market and infrastructure conditions have affected timeline signals, and schedules should be treated as provisional
                <Reference number={7} username="Mainichi Shimbun" date="2024" platform="News" content="Taiwan semiconductor industry developments in Japan" link="https://mainichi.jp/english/search?q=taiwan" />
                .</li>
              <li>Europe: <G>ESMC</G> (<G>Dresden</G> JV: <G>TSMC</G> 70%; Bosch/Infineon/NXP 10% each) is underway, first output expected around 2027, which is geared to auto/industrial nodes. <G>EU Chips Act</G> designations support funding
                <Reference number={6} username="Reuters" date="2024" platform="News" content="EU approves German state aid for $11 billion TSMC chip plant" link="https://www.reuters.com/technology/eu-approves-german-state-aid-11-billion-tsmc-chip-plant-2024-06-24/" />
                .</li>
              <li>South Korea (hedge market): AI boom drives <G>HBM</G>/<G>DRAM</G> tightness, SK hynix/Samsung reporting record profits and sold-out capacity, with national-level AI infrastructure buys. Expect allocation to be the bottleneck
                <Reference number={4} username="Korea Times" date="2024" platform="News" content="Japan protests at Chinese diplomat threat over PM's Taiwan comments" link="https://www.koreatimes.co.kr/www/nation/2024/10/120_387412.html" />
                <Reference number={10} username="Taiwan News" date="2024" platform="News" content="Samsung's foundry customers could turn to Taiwan's TSMC" link="https://www.taiwannews.com.tw/news/5995865" />
                .</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))]">
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Implications for TechForward
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Supply Continuity (0–12 months)</h3>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Highest risk windows cluster around <G>PLA</G> exercise cycles and major typhoon/quake events
              <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
              . Expect freight/insurance spikes and possible short delays; core wafer supply likely holds, but packaging/test and speciality nodes can slip
              <Reference number={2} username="The Straits Times" date="2024" platform="News" content="Taiwan must be allowed equal participation when China hosts APEC" link="https://www.straitstimes.com/asia/east-asia/taiwan-must-be-allowed-equal-participation-when-china-hosts-apec-us-says" />
              .
            </p>
            <p className="text-base font-semibold text-[hsl(var(--report-text))]">
              Action: <G>Buffer Stock</G> critical <G>ASIC</G>s and long-lead substrates.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Investment Climate (12–36 months)</h3>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              European capacity (<G>Dresden</G>) is strategic but late for your 2026–27 demand curve; Japan adds resilience but may not fully cover auto-grade nodes in your <G>BOM</G>
              <Reference number={6} username="Reuters" date="2024" platform="News" content="EU approves German state aid for $11 billion TSMC chip plant" link="https://www.reuters.com/technology/eu-approves-german-state-aid-11-billion-tsmc-chip-plant-2024-06-24/" />
              <Reference number={7} username="Mainichi Shimbun" date="2024" platform="News" content="Taiwan semiconductor industry developments in Japan" link="https://mainichi.jp/english/search?q=taiwan" />
              . Treat it as a medium-term hedge.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Client Confidence</h3>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Automotive <G>OEM</G>s will ask for dual-sourcing by node/package plus visibility on transit/insurance contingencies during <G>PLA</G> drills. Having named second sources in Korea/Japan and an EU pathway (<G>ESMC</G>) materially improves your scorecards
              <Reference number={8} username="TSMC" date="2024" platform="Corporate" content="TSMC Fabs overview and locations" link="https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs" />
              <Reference number={10} username="Taiwan News" date="2024" platform="News" content="Samsung's foundry customers could turn to Taiwan's TSMC" link="https://www.taiwannews.com.tw/news/5995865" />
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Indicators to Watch (Next Quarter)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
            <li><G>PLA</G> exercise notices (maritime/air <G>NOTAM</G>s, exclusion zones) and Chinese civil aviation route moves (e.g., M503/W121 linkages)
              <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
              .</li>
            <li><G>TSMC</G> site updates (Japan phase-2 milestones; <G>Dresden</G> JV progress; <G>Munich</G> design centre ramp) for diversification timelines
              <Reference number={6} username="Reuters" date="2024" platform="News" content="EU approves German state aid for $11 billion TSMC chip plant" link="https://www.reuters.com/technology/eu-approves-german-state-aid-11-billion-tsmc-chip-plant-2024-06-24/" />
              <Reference number={7} username="Mainichi Shimbun" date="2024" platform="News" content="Taiwan semiconductor industry developments in Japan" link="https://mainichi.jp/english/search?q=taiwan" />
              <Reference number={8} username="TSMC" date="2024" platform="Corporate" content="TSMC Fabs overview and locations" link="https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs" />
              .</li>
            <li>Taiwan macro prints (<G>DGBAS</G> <G>GDP</G>/<G>CPI</G>) indicate export strength vs. capacity tightness
              <Reference number={5} username="Taiwan DGBAS" date="2024" platform="Government Statistics" content="National Statistics outline and economic indicators" link="https://eng.stat.gov.tw/np.asp?ctNode=2268" />
              <Reference number={14} username="Taiwan DBAS" date="2024" platform="Government Statistics" content="Department of Budget, Accounting and Statistics data" link="https://eng.dgbas.gov.tw/np.asp?ctNode=2265" />
              .</li>
            <li>Seismic/water bulletins (reservoir levels; quake swarms) near <G>Hsinchu</G>/<G>Tainan</G> science parks
              <Reference number={11} username="Reuters" date="2024" platform="News" content="US targets Chinese companies over drone components used by Hamas, Houthis" link="https://www.reuters.com/world/us/us-sanctions-chinese-companies-over-drone-components-used-by-hamas-houthis-2024-09-12/" />
              <Reference number={12} username="The Diplomat" date="2024" platform="Analysis" content="Taiwan's T-Dome Missile Defense: Balancing Deterrence, Risk, and Regional Stability" link="https://thediplomat.com/2024/10/taiwans-t-dome-missile-defense-balancing-deterrence-risk-and-regional-stability/" />
              .</li>
            <li>Korean <G>HBM</G> announcements (capacity additions/allocations) impacting availability for AI-adjacent automotive systems
              <Reference number={4} username="Korea Times" date="2024" platform="News" content="Japan protests at Chinese diplomat threat over PM's Taiwan comments" link="https://www.koreatimes.co.kr/www/nation/2024/10/120_387412.html" />
              <Reference number={10} username="Taiwan News" date="2024" platform="News" content="Samsung's foundry customers could turn to Taiwan's TSMC" link="https://www.taiwannews.com.tw/news/5995865" />
              .</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Recommendations - Practical Mitigation & Diversification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Near-term (0–6 months)</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>Qualify dual nodes for each critical <G>ASIC</G> (e.g., <G>N28</G>/<G>N40</G> equivalents) and second-source packaging; lock <G>Allocation Contract</G>s that include logistics/insurance clauses covering <G>PLA</G> exercise windows
                <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
                .</li>
              <li>Increase safety stock of microcontrollers/sensors most exposed to Taiwanese <G>OSAT</G> bottlenecks by 4–6 weeks, timed before known exercise seasons/typhoon peaks
                <Reference number={2} username="The Straits Times" date="2024" platform="News" content="Taiwan must be allowed equal participation when China hosts APEC" link="https://www.straitstimes.com/asia/east-asia/taiwan-must-be-allowed-equal-participation-when-china-hosts-apec-us-says" />
                .</li>
              <li>Map tier-2/3 suppliers (substrates, gases, chemicals) and pre-approve alternates in Japan/Korea/EU where standards permit
                <Reference number={8} username="TSMC" date="2024" platform="Corporate" content="TSMC Fabs overview and locations" link="https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs" />
                .</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Medium-term (6-24 months)</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>Korea hedge: Engage Samsung Foundry for mature logic where feasible; secure <G>HBM</G>/<G>DRAM</G> allocations indirectly via module partners aligned with SK hynix. Expect allocations to be the binding constraint
                <Reference number={4} username="Korea Times" date="2024" platform="News" content="Japan protests at Chinese diplomat threat over PM's Taiwan comments" link="https://www.koreatimes.co.kr/www/nation/2024/10/120_387412.html" />
                <Reference number={10} username="Taiwan News" date="2024" platform="News" content="Samsung's foundry customers could turn to Taiwan's TSMC" link="https://www.taiwannews.com.tw/news/5995865" />
                .</li>
              <li>Japan hedge: Expand orders with <G>JASM</G> (<G>Kumamoto</G>) partners as phase-2 materialises; treat 2025–29 schedules as soft and structure penalties/exit ramps
                <Reference number={7} username="Mainichi Shimbun" date="2024" platform="News" content="Taiwan semiconductor industry developments in Japan" link="https://mainichi.jp/english/search?q=taiwan" />
                .</li>
              <li>Europe path: Align designs with <G>ESMC</G> <G>Dresden</G> node roadmap for pilot lots, earliest in 2027. Leverage <G>TSMC</G>'s <G>Munich</G> design centre for <G>DFM</G>/qualification readiness
                <Reference number={6} username="Reuters" date="2024" platform="News" content="EU approves German state aid for $11 billion TSMC chip plant" link="https://www.reuters.com/technology/eu-approves-german-state-aid-11-billion-tsmc-chip-plant-2024-06-24/" />
                <Reference number={8} username="TSMC" date="2024" platform="Corporate" content="TSMC Fabs overview and locations" link="https://www.tsmc.com/english/aboutTSMC/TSMC_Fabs" />
                .</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Governance & Communications</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>Client-facing playbook: Publish a quarterly supply-risk note with named alternates, stock buffers, and transit insurance posture
                <Reference number={2} username="The Straits Times" date="2024" platform="News" content="Taiwan must be allowed equal participation when China hosts APEC" link="https://www.straitstimes.com/asia/east-asia/taiwan-must-be-allowed-equal-participation-when-china-hosts-apec-us-says" />
                .</li>
              <li>Scenario clauses: Add <G>Force-majeure</G>-lite triggers tied to <G>NOTAM</G>/exercise windows to flex logistics routes and inventory releases
                <Reference number={9} username="ECFR" date="2024" platform="Policy Brief" content="Analysis of sanctions lessons from Ukraine applied to Taiwan conflict scenario" link="https://ecfr.eu/publication/hard-fast-and-where-it-hurts-lessons-from-ukraine-related-sanctions-for-a-taiwan-conflict-scenario" />
                .</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Source Notes: OSINT Methods & Caveats
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Methods</h3>
            <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
              Government statistics (Taiwan <G>DGBAS</G>), reputable wire services (Reuters/AP/WSJ), specialist think-tanks (ECFR), and primary vendor releases (<G>TSMC</G>/<G>ESMC</G>). Triangulated schedules with multiple sources due to historical slippage in fab projects.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-[hsl(var(--report-text))]">Caveats</h3>
            <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
              <li>Fab timelines (Japan phase-2; <G>Dresden</G>) are prone to revision; treat any single-date claims as indicative.</li>
              <li>Military activity reporting is timely but partial; insurance and freight responses can overshoot underlying risk during headline spikes.</li>
              <li>Macro upgrades reflect AI-cycle momentum; downside risks: export controls, natural hazards
                <Reference number={12} username="The Diplomat" date="2024" platform="Analysis" content="Taiwan's T-Dome Missile Defense: Balancing Deterrence, Risk, and Regional Stability" link="https://thediplomat.com/2024/10/taiwans-t-dome-missile-defense-balancing-deterrence-risk-and-regional-stability/" />
                <Reference number={15} username="SIA" date="2025" platform="Industry Report" content="Semiconductor Industry Association State of the Industry Report 2025" link="https://www.semiconductors.org/wp-content/uploads/2025/05/SIA-State-of-the-Industry-Report-2025.pdf" />
                .</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))]">
        <CardHeader>
          <CardTitle className="text-2xl text-[hsl(var(--report-text))]">
            Appendix - TechForward-Specific Implications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base text-[hsl(var(--report-text))] leading-relaxed">
            Your exposure: 60% critical components from Taiwan means that you should operationally set a buffer policy to cover one full production cycle +2 weeks for auto-grade SKUs.
          </p>
          <ul className="space-y-2 list-disc list-inside text-base text-[hsl(var(--report-text))] leading-relaxed">
            <li>Design roadmap: Prioritise <G>Node Portability</G> designs; avoid lock-in to a single <G>OSAT</G>.</li>
            <li>Contracts: Where possible, index delivery windows (not only price) to pre-announced <G>PLA</G> exercise periods.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
