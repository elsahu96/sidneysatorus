import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Building2, Globe, Shield } from "lucide-react";

interface InvestigationReportProps {
  name: string;
}

export const InvestigationReport = ({ name }: InvestigationReportProps) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[hsl(var(--report-border))] pb-6">
        <h2 className="text-3xl font-bold text-foreground mb-4">{name}</h2>
        <div className="flex items-center gap-3">
          <Badge className="gap-1.5 bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))] text-[hsl(var(--warning-text))] hover:bg-[hsl(var(--warning-bg))]">
            <AlertCircle className="h-3.5 w-3.5" />
            High Risk
          </Badge>
          <Badge variant="outline" className="bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">PEP</Badge>
          <Badge variant="outline" className="bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">Sanctioned</Badge>
        </div>
      </div>

      {/* Key Findings */}
      <Card className="p-6 bg-[hsl(var(--info-bg))] border-[hsl(var(--info-border))]">
        <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Key Findings
        </h3>
        <p className="text-[hsl(var(--report-text))] leading-relaxed text-base">
          The Know Your Customer (KYC) investigation into Roman Abramovich reveals significant adverse information, 
          primarily concerning his close ties to the President of the Russian Federation, Vladimir Putin, and his 
          substantial business interests that contribute significantly to the Russian government's revenue. He is 
          identified as a Politically Exposed Person (PEP) and is subject to extensive international sanctions due 
          to his involvement in economic sectors providing substantial revenue to the Russian government, which is 
          deemed responsible for the annexation of Crimea and the destabilization of Ukraine. Allegations of 
          involvement in corruption schemes related to Gazprom PJSC have also been noted. While he holds Russian, 
          Israeli, and Portuguese nationalities, a search for corporate officer roles in the UK Companies House 
          yielded no results.
        </p>
      </Card>

      {/* Detailed Results */}
      <div className="space-y-5">
        <h3 className="text-xl font-semibold text-foreground">Detailed Results</h3>

        {/* Personal Details */}
        <Card className="p-6 bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">
          <h4 className="font-semibold text-foreground mb-4 text-lg">1. Personal Details</h4>
          <dl className="space-y-3 text-base">
            <div className="flex gap-3">
              <dt className="font-medium text-foreground min-w-36">Name:</dt>
              <dd className="text-[hsl(var(--report-text))]">Roman Arkadyevich Abramovich</dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-medium text-foreground min-w-36">Date of Birth:</dt>
              <dd className="text-[hsl(var(--report-text))]">24 October 1966</dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-medium text-foreground min-w-36">Place of Birth:</dt>
              <dd className="text-[hsl(var(--report-text))]">Saratov, Russian Federation</dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-medium text-foreground min-w-36">Nationalities:</dt>
              <dd className="text-[hsl(var(--report-text))]">Russian, Israeli, Portuguese</dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-medium text-foreground min-w-36">Known Addresses:</dt>
              <dd className="space-y-1.5 text-[hsl(var(--report-text))]">
                <p>1 Lipovaya Aleya, Nemchinovo, Russian Federation</p>
                <p>Apartment 35.1 1 Waterfront Drive, London SW10 0AA, England</p>
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-medium text-foreground min-w-36">Education:</dt>
              <dd className="text-[hsl(var(--report-text))]">Moscow State Law University, Gubkin University</dd>
            </div>
            <div className="flex gap-3">
              <dt className="font-medium text-foreground min-w-36">Religion:</dt>
              <dd className="text-[hsl(var(--report-text))]">Judaism</dd>
            </div>
          </dl>
        </Card>

        {/* Political Exposure */}
        <Card className="p-6 bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            2. Political Exposure and Affiliations
          </h4>
          <p className="text-[hsl(var(--report-text))] leading-relaxed text-base">
            Roman Abramovich is classified as a Politically Exposed Person (PEP) due to his former role as 
            Governor of Chukotka Autonomous Okrug (2000-2008) and his well-documented, long-standing, and close 
            ties to President Vladimir Putin. These connections date back to the late 1990s and are reported to 
            have provided him with privileged access to the president, aiding in the preservation of his considerable 
            wealth. He was part of the circle that supported Putin's ascent to the presidency.
          </p>
        </Card>

        {/* Business Interests */}
        <Card className="p-6 bg-[hsl(var(--report-highlight))] border-[hsl(var(--report-border))]">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            3. Business Interests and Financial Connections
          </h4>
          <p className="text-[hsl(var(--report-text))] leading-relaxed mb-4 text-base">
            Abramovich holds significant stakes in major Russian companies, which have been identified as providing 
            substantial revenue to the Russian government:
          </p>
          <ul className="space-y-4 text-base">
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">Evraz:</strong> He is a major shareholder, directly owning 28.64% 
              of the shares. Evraz is one of Russia's largest taxpayers and supplies raw materials to defense industry 
              companies, including Uralvagonzavod, a producer of tanks.
            </li>
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">Norilsk Nickel:</strong> He is a shareholder in this Russian company, 
              one of the world's largest palladium producers and a major refined nickel company in the mining sector.
            </li>
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">Other Investments:</strong> He also owns shares in other significant 
              Russian companies such as Yandex and Renaissance Insurance.
            </li>
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">Millhouse Capital:</strong> He is identified as the owner of 
              Millhouse Capital.
            </li>
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">Gazprom PJSC:</strong> He has been implicated in corruption schemes 
              related to Gazprom PJSC and its subsidiaries, allegedly playing a role in generating corrupt income for 
              Vladimir Putin and his closest associates.
            </li>
          </ul>
          <p className="text-[hsl(var(--report-text))] leading-relaxed mt-4 text-base">
            His business ventures are stated to have benefited from Russian decision-makers responsible for the 
            annexation of Crimea and the destabilization of Ukraine.
          </p>
        </Card>

        {/* Sanctions */}
        <Card className="p-6 bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))]">
          <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-[hsl(var(--warning-text))]" />
            4. Sanctions and Adverse Information
          </h4>
          <p className="text-[hsl(var(--report-text))] leading-relaxed mb-4 text-base">
            Roman Abramovich is subject to a range of sanctions and restrictive measures from multiple jurisdictions, 
            primarily due to his status as a leading Russian businessperson operating in sectors providing substantial 
            revenue to the Russian government, which is responsible for actions against Ukraine:
          </p>
          <ul className="space-y-4 text-base">
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">EU Sanctions:</strong> He has been sanctioned by the EU, effective 
              March 15, 2022, leading to asset freezes and travel bans. The EU specifically noted his involvement in 
              economic sectors providing a substantial source of revenue to the Government of the Russian Federation.
            </li>
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">UK Sanctions:</strong> The UK imposed sanctions on him, including an 
              asset freeze, travel ban, and transport sanctions, effective March 10, 2022. Transport sanctions prohibit 
              ships and aircraft owned, controlled, chartered, or operated by him from entering or overflying the UK.
            </li>
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">Ukraine Sanctions:</strong> Ukraine has also imposed personal, special, 
              economic, and other restrictive measures (sanctions) against him.
            </li>
            <li className="text-[hsl(var(--report-text))]">
              <strong className="text-foreground">Other Designations:</strong> He was mentioned in the 2018 CAATSA report 
              on Russian oligarchs. A Director Disqualification Sanction was imposed on April 9, 2025.
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};
