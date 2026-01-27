import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Flag, MessageSquare, Users, BookMarked, ExternalLink } from "lucide-react";
import { Reference } from "@/components/Reference";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RussellCherryReportProps {
  username: string;
}

// Reference data structure for easy management
const references = [
  {
    number: 1,
    username: "russcherry5",
    date: "April 8, 2016",
    platform: "X (Twitter)",
    content: "I`m backing Dr Bob for UKIP PCC we need to protect our police from further cuts to numbers and resources. More cops on the streets.",
    link: "https://x.com/russcherry5/status/718509278143844352?s=20"
  },
  {
    number: 2,
    username: "russcherry5",
    date: "April 8, 2016",
    platform: "X (Twitter)",
    content: "hours of leafleting with CSM Cllr candidate Mathew Torri, and meeting lots of UKIP supporters on the streets.",
    link: "https://x.com/russcherry5/status/718505749505302528?s=20"
  },
  {
    number: 3,
    username: "russcherry5",
    date: "August 29, 2015",
    platform: "X (Twitter)",
    content: "canvassing at WTSS ward with our great #UKIP candidate Helen Adams. Joined by #Suzanne Evans and #Tink.",
    link: "https://x.com/russcherry5/status/637635540691615744?s=20"
  },
  {
    number: 4,
    username: "russcherry5",
    date: "September 5, 2015",
    platform: "X (Twitter)",
    content: "Wait until some of them rise up with their Kalashnikovs and force Islam on us then you will realise what you have done with your tolerance.",
    link: "https://x.com/russcherry5/status/639911958347665412?s=20"
  },
  {
    number: 5,
    username: "russcherry5",
    date: "September 5, 2015",
    platform: "X (Twitter)",
    content: "Europe has gone mad. It is allowing itself to be taken over by an army who have no tanks or guns. The tolerant will lose to the intolerant.",
    link: "https://x.com/russcherry5/status/639911362546765824?s=20"
  },
  {
    number: 6,
    username: "russcherry5",
    date: "September 2, 2015",
    platform: "X (Twitter)",
    content: "I wouldn`t mind betting that Putin is pulling the strings of Merkle to bring down Europe using uncontrolled immigration as a weapon!",
    link: "https://x.com/russcherry5/status/638822334099386368?s=20"
  },
  {
    number: 7,
    username: "russcherry5",
    date: "September 3, 2015",
    platform: "X (Twitter)",
    content: "Just watched Emma Thompson on Newsnight she is not in touch with reality says we should take these immigrants from Calais.",
    link: "https://x.com/russcherry5/status/639196921169616897?s=20"
  },
  {
    number: 8,
    username: "russcherry5",
    date: "September 3, 2015",
    platform: "X (Twitter)",
    content: "Will she put them up? I still have people on my ward who have been on the council waiting list 18 years! Get real Emma.",
    link: "https://x.com/russcherry5/status/639197416466567168?s=20"
  },
  {
    number: 9,
    username: "russcherry5",
    date: "September 4, 2015",
    platform: "X (Twitter)",
    content: "Because there are so many chancers jumping on the bandwagon. And we still have a responsibility to our own people. This should be UK priority.",
    link: "https://x.com/russcherry5/status/639517334055591937?s=20"
  },
  {
    number: 10,
    username: "russcherry5",
    date: "September 2, 2015",
    platform: "X (Twitter)",
    content: "Will they jump ahead of you in the council waiting list? There is no spare housing.",
    link: "https://x.com/russcherry5/status/638810812057026560?s=20"
  },
  {
    number: 11,
    username: "russcherry5",
    date: "September 2, 2015",
    platform: "X (Twitter)",
    content: "I asked the council if this could be cleaned ASAP as it had a swastika & other offensive graffiti. And they were brilliant.",
    link: "https://x.com/russcherry5/status/639158870523400192?s=20"
  },
  {
    number: 12,
    username: "russcherry5",
    date: "August 28, 2015",
    platform: "X (Twitter)",
    content: "Democratically elected Governments in European countries bending the knee to EU officials who we do not know. Their hopeless.",
    link: "https://x.com/russcherry5/status/637180142503239680?s=20"
  },
  {
    number: 13,
    username: "russcherry5",
    date: "August 27, 2015",
    platform: "X (Twitter)",
    content: "Cameron it's not worth having something that's good unless you can protect it. Stop stripping the police of their numbers and their powers.",
    link: "https://x.com/russcherry5/status/637033989186916354?s=20"
  },
  {
    number: 14,
    username: "russcherry5",
    date: "September 1, 2015",
    platform: "X (Twitter)",
    content: "I have been liaising with the local police regards scrambler bikes in Thurrock. To let you know there is an operation starting soon.",
    link: "https://x.com/russcherry5/status/638808003421052928?s=20"
  },
  {
    number: 15,
    username: "russcherry5",
    date: "May 4, 2016",
    platform: "X (Twitter)",
    content: "@thurrocksanswer @yourthurrock @Matt_Torri Time to stop all his gerrymandering in Full council and history lessons.",
    link: "https://x.com/russcherry5/status/727908473556602881?s=20"
  }
];

export const RussellCherryReport = ({ username }: RussellCherryReportProps) => {
  const [referencesOpen, setReferencesOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[hsl(var(--report-border))] pb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Russell Cherry</h2>
            <p className="text-[hsl(var(--report-text-secondary))] mt-2 text-base">@{username}</p>
          </div>
          <div className="flex gap-3 items-center">
            <Sheet open={referencesOpen} onOpenChange={setReferencesOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">
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
            <Badge className="gap-1.5 bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))] text-[hsl(var(--warning-text))] hover:bg-[hsl(var(--warning-bg))]">
              <AlertTriangle className="h-3.5 w-3.5" />
              Controversial Content
            </Badge>
            <Badge variant="outline" className="bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">UKIP Affiliated</Badge>
          </div>
        </div>
      </div>

      {/* Key Findings */}
      <Card className="bg-[hsl(var(--info-bg))] border-[hsl(var(--info-border))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Flag className="h-5 w-5 text-primary" />
            Key Findings
          </CardTitle>
        </CardHeader>
        <CardContent className="text-base leading-relaxed text-[hsl(var(--report-text))]">
          The investigation into Russell Cherry's X (formerly Twitter) profile (@{username}) reveals a strong affiliation
          with the UK Independence Party (UKIP) and pronounced political views centered on anti-immigration, pro-Brexit
          sentiments, and concerns regarding law enforcement. Several posts contain statements that could be considered
          controversial, particularly those expressing alarmist views on immigration and linking it to potential societal
          threats and European destabilization.
        </CardContent>
      </Card>

      {/* Political Affiliations and Views */}
      <Card className="bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5 text-primary" />
            Political Affiliations and Views
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-base">
          <div>
            <p className="text-[hsl(var(--report-text))] mb-4">
              Russell Cherry's X activity clearly indicates a strong alignment with the UK Independence Party (UKIP).
              His posts frequently reference UKIP candidates and policies:
            </p>
            <ul className="space-y-3">
              <li className="flex gap-3">
                <span className="text-primary mt-1">•</span>
                <span className="text-[hsl(var(--report-text))]">
                  He openly states, "I`m backing Dr Bob for UKIP PCC we need to protect our police from further cuts to numbers and resources. More cops on the streets."
                  <Reference {...references[0]} />
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary mt-1">•</span>
                <span className="text-[hsl(var(--report-text))]">
                  He mentions "hours of leafleting with CSM Cllr candidate Mathew Torri," and meeting "lots of UKIP supporters on the streets."
                  <Reference {...references[1]} />
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-primary mt-1">•</span>
                <span className="text-[hsl(var(--report-text))]">
                  He was "canvassing at WTSS ward with our great #UKIP candidate Helen Adams. Joined by #Suzanne Evans and #Tink."
                  <Reference {...references[2]} />
                </span>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground mb-3 text-lg">His political views are consistently expressed across several key areas:</p>
            <div className="space-y-4">
              <div>
                <p className="font-medium text-foreground mb-2">Immigration:</p>
                <p className="text-[hsl(var(--report-text))]">
                  Cherry holds very strong, negative views on immigration, frequently expressing concerns about its impact on the UK and Europe. He advocates for stricter controls and questions the motives and authenticity of migrants.
                  <Reference {...references[3]} />
                  <Reference {...references[4]} />
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Brexit:</p>
                <p className="text-[hsl(var(--report-text))]">
                  He is a firm supporter of Brexit, viewing it as a positive step for the UK, especially in light of perceived struggles in other European countries to cope with migration.
                  <Reference {...references[11]} />
                  <Reference {...references[4]} />
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Law Enforcement and Crime:</p>
                <p className="text-[hsl(var(--report-text))]">
                  He frequently criticizes cuts to police numbers and resources, linking this to an increase in crime and a feeling of insecurity among citizens. He also actively engages with local policing issues, such as tackling scrambler bikes and traveller incursions.
                  <Reference {...references[12]} />
                  <Reference {...references[13]} />
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-2">Local Council Matters:</p>
                <p className="text-[hsl(var(--report-text))]">
                  As a councillor, he posts about local issues, such as reporting graffiti and requesting improvements to public spaces. He also criticizes what he perceives as "gerrymandering" by other councillors.
                  <Reference {...references[10]} />
                  <Reference {...references[14]} />
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controversial Content */}
      <Card className="bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning-text))]" />
            Controversial Content
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-base">
          <p className="text-[hsl(var(--report-text))]">
            Several posts made by Russell Cherry contain language and views that could be considered controversial:
          </p>

          <div className="space-y-5">
            <div>
              <p className="font-semibold text-foreground mb-3">Alarmist Immigration Rhetoric:</p>
              <div className="space-y-3">
                <p className="italic border-l-2 border-[hsl(var(--warning-text))] pl-4 py-1 text-[hsl(var(--report-text))]">
                  "Wait until some of them rise up with their Kalashnikovs and force Islam on us then you will realise what you have done with your tolerance."
                  <Reference {...references[3]} />
                </p>
                <p className="italic border-l-2 border-[hsl(var(--warning-text))] pl-4 py-1 text-[hsl(var(--report-text))]">
                  "Europe has gone mad. It is allowing itself to be taken over by an army who have no tanks or guns. The tolerant will lose to the intolerant."
                  <Reference {...references[4]} />
                </p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-3">Conspiracy Theories:</p>
              <p className="italic border-l-2 border-[hsl(var(--warning-text))] pl-4 py-1 text-[hsl(var(--report-text))]">
                "I wouldn`t mind betting that Putin is pulling the strings of Merkle to bring down Europe using uncontrolled immigration as a weapon!"
                <Reference {...references[5]} />
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-3">Criticism of Pro-Immigration Stances:</p>
              <div className="space-y-3">
                <p className="italic border-l-2 border-[hsl(var(--warning-text))] pl-4 py-1 text-[hsl(var(--report-text))]">
                  "Just watched Emma Thompson on Newsnight she is not in touch with reality says we should take these immigrants from Calais."
                  <Reference {...references[6]} />
                </p>
                <p className="italic border-l-2 border-[hsl(var(--warning-text))] pl-4 py-1 text-[hsl(var(--report-text))]">
                  "Will she put them up? I still have people on my ward who have been on the council waiting list 18 years! Get real Emma."
                  <Reference {...references[7]} />
                </p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-3">General Distrust of Migrants:</p>
              <div className="space-y-3">
                <p className="italic border-l-2 border-[hsl(var(--warning-text))] pl-4 py-1 text-[hsl(var(--report-text))]">
                  "Because there are so many chancers jumping on the bandwagon. And we still have a responsibility to our own people. This should be UK priority."
                  <Reference {...references[8]} />
                </p>
                <p className="italic border-l-2 border-[hsl(var(--warning-text))] pl-4 py-1 text-[hsl(var(--report-text))]">
                  "Will they jump ahead of you in the council waiting list? There is no spare housing."
                  <Reference {...references[9]} />
                </p>
              </div>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-3">Reporting Offensive Graffiti:</p>
              <p className="text-[hsl(var(--report-text))]">
                While not controversial in itself, one post mentions him requesting the council to clean graffiti that
                "had a swastika & other offensive graffiti," indicating his awareness and response to such symbols.
                <Reference {...references[10]} />
              </p>
            </div>

            <div>
              <p className="font-semibold text-foreground mb-3">Criticism of EU Officials:</p>
              <p className="text-[hsl(var(--report-text))]">
                He describes democratically elected European governments as "bending the knee to EU officials who we do not know"
                and refers to "these idiots in charge of Europe."
                <Reference {...references[11]} />
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
