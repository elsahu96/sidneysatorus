import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CaseFile {
  id: string;
  caseNumber: string;
  subject: string;
  timestamp: number;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    isReport?: boolean;
    isRussellCherryReport?: boolean;
    isTaiwanReport?: boolean;
    isDarkWebReport?: boolean;
    isIranianPetrochemicalsReport?: boolean;
    selectedAccount?: string;
  }>;
}

export const exportReportToPDF = (caseFile: CaseFile) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Find the report type
  const reportMessage = caseFile.messages.find(
    m => m.isReport || m.isRussellCherryReport || m.isTaiwanReport || 
         m.isDarkWebReport || m.isIranianPetrochemicalsReport
  );

  if (!reportMessage) {
    doc.text("No report found", margin, yPosition);
    doc.save(`${caseFile.caseNumber}.pdf`);
    return;
  }

  // Export based on report type
  if (reportMessage.isRussellCherryReport) {
    exportRussellCherryReport(doc, reportMessage.selectedAccount || "russcherry5");
  } else if (reportMessage.isTaiwanReport) {
    exportTaiwanReport(doc);
  } else if (reportMessage.isDarkWebReport) {
    exportDarkWebReport(doc);
  } else if (reportMessage.isIranianPetrochemicalsReport) {
    exportIranianPetrochemicalsReport(doc);
  } else if (reportMessage.isReport) {
    exportInvestigationReport(doc, reportMessage.content);
  }

  // Save the PDF
  const filename = `${caseFile.caseNumber.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.pdf`;
  doc.save(filename);
};

const addText = (doc: jsPDF, text: string, x: number, y: number, maxWidth: number, fontSize: number = 10): number => {
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + (lines.length * fontSize * 0.4);
};

const checkPageBreak = (doc: jsPDF, yPosition: number, neededSpace: number = 20): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPosition + neededSpace > pageHeight - 15) {
    doc.addPage();
    return 15;
  }
  return yPosition;
};

const exportInvestigationReport = (doc: jsPDF, name: string) => {
  const margin = 15;
  const maxWidth = doc.internal.pageSize.getWidth() - (margin * 2);
  let y = margin;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  y = addText(doc, name, margin, y, maxWidth, 18);
  y += 5;

  // Badges
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Status: High Risk | PEP | Sanctioned", margin, y);
  y += 10;

  // Key Findings
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Key Findings", margin, y, maxWidth, 14);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const keyFindings = "The Know Your Customer (KYC) investigation into Roman Abramovich reveals significant adverse information, primarily concerning his close ties to the President of the Russian Federation, Vladimir Putin, and his substantial business interests that contribute significantly to the Russian government's revenue. He is identified as a Politically Exposed Person (PEP) and is subject to extensive international sanctions due to his involvement in economic sectors providing substantial revenue to the Russian government, which is deemed responsible for the annexation of Crimea and the destabilization of Ukraine. Allegations of involvement in corruption schemes related to Gazprom PJSC have also been noted. While he holds Russian, Israeli, and Portuguese nationalities, a search for corporate officer roles in the UK Companies House yielded no results.";
  y = addText(doc, keyFindings, margin, y, maxWidth);
  y += 10;

  // Personal Details
  y = checkPageBreak(doc, y, 50);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "1. Personal Details", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const personalDetails = [
    ["Name:", "Roman Arkadyevich Abramovich"],
    ["Date of Birth:", "24 October 1966"],
    ["Place of Birth:", "Saratov, Russian Federation"],
    ["Nationalities:", "Russian, Israeli, Portuguese"],
    ["Known Addresses:", "1 Lipovaya Aleya, Nemchinovo, Russian Federation\nApartment 35.1 1 Waterfront Drive, London SW10 0AA, England"],
    ["Education:", "Moscow State Law University, Gubkin University"],
    ["Religion:", "Judaism"]
  ];

  personalDetails.forEach(([label, value]) => {
    y = checkPageBreak(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    const valueLines = doc.splitTextToSize(value, maxWidth - 50);
    doc.text(valueLines, margin + 50, y);
    y += valueLines.length * 5;
  });
  y += 5;

  // Political Exposure
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "2. Political Exposure and Affiliations", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const politicalExposure = "Roman Abramovich is classified as a Politically Exposed Person (PEP) due to his former role as Governor of Chukotka Autonomous Okrug (2000-2008) and his well-documented, long-standing, and close ties to President Vladimir Putin. These connections date back to the late 1990s and are reported to have provided him with privileged access to the president, aiding in the preservation of his considerable wealth. He was part of the circle that supported Putin's ascent to the presidency.";
  y = addText(doc, politicalExposure, margin, y, maxWidth);
  y += 10;

  // Business Interests
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "3. Business Interests and Financial Connections", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Abramovich holds significant stakes in major Russian companies, which have been identified as providing substantial revenue to the Russian government:", margin, y, maxWidth);
  y += 5;

  const businessPoints = [
    "Evraz: He is a major shareholder, directly owning 28.64% of the shares. Evraz is one of Russia's largest taxpayers and supplies raw materials to defense industry companies, including Uralvagonzavod, a producer of tanks.",
    "Norilsk Nickel: He is a shareholder in this Russian company, one of the world's largest palladium producers and a major refined nickel company in the mining sector.",
    "Other Investments: He also owns shares in other significant Russian companies such as Yandex and Renaissance Insurance.",
    "Millhouse Capital: He is identified as the owner of Millhouse Capital.",
    "Gazprom PJSC: He has been implicated in corruption schemes related to Gazprom PJSC and its subsidiaries, allegedly playing a role in generating corrupt income for Vladimir Putin and his closest associates."
  ];

  businessPoints.forEach(point => {
    y = checkPageBreak(doc, y, 20);
    const lines = doc.splitTextToSize("• " + point, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
  y += 5;

  y = checkPageBreak(doc, y, 15);
  y = addText(doc, "His business ventures are stated to have benefited from Russian decision-makers responsible for the annexation of Crimea and the destabilization of Ukraine.", margin, y, maxWidth);
  y += 10;

  // Sanctions
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "4. Sanctions and Adverse Information", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Roman Abramovich is subject to a range of sanctions and restrictive measures from multiple jurisdictions, primarily due to his status as a leading Russian businessperson operating in sectors providing substantial revenue to the Russian government, which is responsible for actions against Ukraine:", margin, y, maxWidth);
  y += 5;

  const sanctionsPoints = [
    "EU Sanctions: He has been sanctioned by the EU, effective March 15, 2022, leading to asset freezes and travel bans. The EU specifically noted his involvement in economic sectors providing a substantial source of revenue to the Government of the Russian Federation.",
    "UK Sanctions: The UK imposed sanctions on him, including an asset freeze, travel ban, and transport sanctions, effective March 10, 2022. Transport sanctions prohibit ships and aircraft owned, controlled, chartered, or operated by him from entering or overflying the UK.",
    "Ukraine Sanctions: Ukraine has also imposed personal, special, economic, and other restrictive measures (sanctions) against him.",
    "Other Designations: He was mentioned in the 2018 CAATSA report on Russian oligarchs. A Director Disqualification Sanction was imposed on April 9, 2025."
  ];

  sanctionsPoints.forEach(point => {
    y = checkPageBreak(doc, y, 20);
    const lines = doc.splitTextToSize("• " + point, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
};

const exportRussellCherryReport = (doc: jsPDF, username: string) => {
  const margin = 15;
  const maxWidth = doc.internal.pageSize.getWidth() - (margin * 2);
  let y = margin;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Russell Cherry", margin, y, maxWidth, 18);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  y = addText(doc, `@${username}`, margin, y, maxWidth, 12);
  y += 10;

  // Risk Badge
  doc.setFontSize(10);
  doc.text("Risk Level: MEDIUM", margin, y);
  y += 10;

  // Executive Summary
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Executive Summary", margin, y, maxWidth, 14);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summary = "Analysis of @russcherry5's digital footprint reveals a profile consistent with engagement in UK political discourse, primarily associated with UKIP activism during 2015-2016. Content includes campaign activities, immigration commentary, and local council matters. Several posts contain strong anti-immigration rhetoric that warrants attention in risk assessment contexts. The account shows decreased activity in recent years.";
  y = addText(doc, summary, margin, y, maxWidth);
  y += 10;

  // Key Findings
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Key Findings", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const findings = [
    {
      title: "Political Affiliation",
      content: "Active UKIP supporter and campaigner during 2015-2016 period. Engaged in door-to-door campaigning, leafleting, and social media promotion of UKIP candidates and policies."
    },
    {
      title: "Immigration Stance",
      content: "Multiple posts expressing opposition to immigration and refugee intake, using inflammatory language about cultural threats and resource allocation. Notable quotes include references to 'Kalashnikovs,' 'forcing Islam,' and comparisons to military invasion."
    },
    {
      title: "Local Council Engagement",
      content: "Former councillor involvement evident through references to ward work, constituent services, and council housing waiting lists. Active on local policing and anti-social behavior issues."
    },
    {
      title: "Activity Pattern",
      content: "Peak activity during 2015-2016 coinciding with UK election cycles. Minimal recent activity suggests account may be dormant or user has shifted to other platforms."
    }
  ];

  findings.forEach(finding => {
    y = checkPageBreak(doc, y, 25);
    doc.setFont("helvetica", "bold");
    y = addText(doc, finding.title, margin, y, maxWidth, 10);
    y += 2;
    doc.setFont("helvetica", "normal");
    y = addText(doc, finding.content, margin, y, maxWidth);
    y += 5;
  });

  // Risk Assessment
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Risk Assessment", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const riskItems = [
    { category: "Reputational Risk", level: "Medium", rationale: "Public association with far-right political movement and inflammatory rhetoric on immigration could present reputational concerns in sensitive contexts." },
    { category: "Radicalization Indicators", level: "Low-Medium", rationale: "Language includes references to violence and cultural conflict, though appears to be political rhetoric rather than direct action planning." },
    { category: "Operational Security", level: "Low", rationale: "Public profile with historical political activism. No evidence of current extremist engagement or security threat." }
  ];

  riskItems.forEach(item => {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.text(`${item.category}: ${item.level}`, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    y = addText(doc, item.rationale, margin, y, maxWidth);
    y += 5;
  });

  // Sample Quotes
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Notable Quotes (Sample)", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  
  const quotes = [
    { date: "September 5, 2015", text: "Wait until some of them rise up with their Kalashnikovs and force Islam on us then you will realise what you have done with your tolerance." },
    { date: "September 5, 2015", text: "Europe has gone mad. It is allowing itself to be taken over by an army who have no tanks or guns. The tolerant will lose to the intolerant." },
    { date: "September 2, 2015", text: "I wouldn't mind betting that Putin is pulling the strings of Merkle to bring down Europe using uncontrolled immigration as a weapon!" }
  ];

  quotes.forEach(quote => {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.text(quote.date, margin, y);
    y += 4;
    doc.setFont("helvetica", "italic");
    y = addText(doc, `"${quote.text}"`, margin, y, maxWidth, 9);
    y += 5;
  });
};

const exportTaiwanReport = (doc: jsPDF) => {
  const margin = 15;
  const maxWidth = doc.internal.pageSize.getWidth() - (margin * 2);
  let y = margin;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Taiwan Contingency Preparedness", margin, y, maxWidth, 18);
  y += 3;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Humanitarian Intervention Planning Considerations", margin, y, maxWidth, 12);
  y += 10;

  // Classification
  doc.setFontSize(10);
  doc.text("Classification: TLP:AMBER | Planning Document", margin, y);
  y += 10;

  // Executive Summary
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Executive Summary", margin, y, maxWidth, 14);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const execSummary = "This briefing provides operational planning considerations for humanitarian organizations preparing contingency responses to a potential Taiwan Strait conflict. Analysis incorporates lessons from Ukraine operations, regional geopolitical dynamics, and logistical constraints specific to an island theater. The document addresses pre-positioning strategies, supply chain vulnerabilities, coordination frameworks, and risk mitigation approaches for NGO deployment in a high-intensity conflict environment.";
  y = addText(doc, execSummary, margin, y, maxWidth);
  y += 10;

  // Situation Overview
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "1. Situation Overview", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const situationPoints = [
    {
      title: "Conflict Probability Assessment",
      content: "Current tensions between PRC and Taiwan remain elevated. While full-scale invasion is not imminent, planning horizons of 2-5 years are prudent for major NGO preparedness initiatives."
    },
    {
      title: "Humanitarian Impact Projection",
      content: "Initial conflict phase would likely generate 2-4 million IDPs within Taiwan, with potential refugee flows to Japan, Philippines, and other regional states. Maritime blockade scenarios could create acute food and medical supply shortages within weeks."
    },
    {
      title: "Operating Environment",
      content: "Unlike Ukraine, Taiwan's island geography limits overland supply routes and complicates mass civilian evacuation. Air/sea access would be contested, requiring early pre-positioning and alternative logistics."
    }
  ];

  situationPoints.forEach(point => {
    y = checkPageBreak(doc, y, 25);
    doc.setFont("helvetica", "bold");
    y = addText(doc, point.title, margin, y, maxWidth, 10);
    y += 2;
    doc.setFont("helvetica", "normal");
    y = addText(doc, point.content, margin, y, maxWidth);
    y += 5;
  });

  // Strategic Recommendations
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "2. Strategic Recommendations", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const recommendations = [
    "Establish pre-positioned supply caches in Japan, Philippines, and Guam for rapid response capability",
    "Develop maritime logistics partnerships with commercial shipping and port authorities in the region",
    "Create coordination frameworks with Taiwanese civil defense and disaster response agencies",
    "Build relationships with regional military logistic commands for potential coordination channels",
    "Establish early warning triggers and decision matrices for activation of contingency plans",
    "Conduct scenario-based training exercises with partner organizations"
  ];

  recommendations.forEach(rec => {
    y = checkPageBreak(doc, y, 15);
    const lines = doc.splitTextToSize("• " + rec, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
  y += 5;

  // Logistical Considerations
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "3. Logistical Considerations", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const logisticsPoints = [
    {
      title: "Supply Chain Vulnerabilities",
      content: "Taiwan imports 98% of energy and 70% of food. Maritime blockade would create immediate humanitarian crisis. Pre-crisis stockpiling of medical supplies, water purification equipment, and non-perishable food is essential."
    },
    {
      title: "Access Routes",
      content: "Air access would likely be restricted to military/government flights. Sea routes via Japan or Philippines offer better capacity but higher risk. Establish relationships with maritime logistics providers now."
    },
    {
      title: "In-Country Positioning",
      content: "Mountainous eastern Taiwan offers geographic protection but limited infrastructure. Western population centers more vulnerable but better logistics. Balance risk and operational effectiveness in positioning decisions."
    }
  ];

  logisticsPoints.forEach(point => {
    y = checkPageBreak(doc, y, 25);
    doc.setFont("helvetica", "bold");
    y = addText(doc, point.title, margin, y, maxWidth, 10);
    y += 2;
    doc.setFont("helvetica", "normal");
    y = addText(doc, point.content, margin, y, maxWidth);
    y += 5;
  });

  // Risk Factors
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "4. Risk Factors and Mitigation", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const risks = [
    { risk: "Staff Safety in Kinetic Environment", mitigation: "Establish hardened facilities, coordinate with Taiwanese civil defense, ensure staff insurance and emergency extraction capabilities." },
    { risk: "Political Access Denial", mitigation: "Build relationships with multiple stakeholders including opposition parties. Maintain operational independence and humanitarian principles." },
    { risk: "Supply Interdiction", mitigation: "Diversify supply chains, use neutral-flagged vessels where possible, coordinate with ICRC and UN OCHA for protected convoy systems." }
  ];

  risks.forEach(item => {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.text(`Risk: ${item.risk}`, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    y = addText(doc, `Mitigation: ${item.mitigation}`, margin, y, maxWidth);
    y += 5;
  });

  // Next Steps
  y = checkPageBreak(doc, y, 20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "5. Immediate Next Steps", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const nextSteps = [
    "Initiate formal consultations with Taiwanese disaster management authorities",
    "Commission detailed logistics feasibility study for pre-positioning options",
    "Engage regional governments (Japan, Philippines) on contingency cooperation agreements",
    "Develop detailed operational plans for various conflict scenarios",
    "Allocate budget for preparedness activities and pre-positioned supplies"
  ];

  nextSteps.forEach(step => {
    y = checkPageBreak(doc, y, 15);
    const lines = doc.splitTextToSize("• " + step, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
};

const exportDarkWebReport = (doc: jsPDF) => {
  const margin = 15;
  const maxWidth = doc.internal.pageSize.getWidth() - (margin * 2);
  let y = margin;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "AAH Threat Assessment - East Baghdad", margin, y, maxWidth, 18);
  y += 3;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Dark Web Intelligence Investigation", margin, y, maxWidth, 12);
  y += 10;

  // Executive Summary
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Executive Summary", margin, y, maxWidth, 14);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const summaryFields = [
    { label: "Investigation objective:", value: "Identify dangerous actors associated (directly or indirectly) with Asa'ib Ahl al-Haq (AAH) and assess the risk they pose to NGO staff operating in East Baghdad." },
    { label: "Outcome:", value: "Two hostile actor clusters identified from read-only dark-web analysis: (1) an active recruiter/arms seller calling volunteers to arms in East Baghdad, and (2) an ex-prisoner cell with extremist sympathies linked to elements of the Iraqi military. Both findings require immediate operational mitigation and legal escalation." },
    { label: "Confidence:", value: "Moderate for socio-digital sentiment and actor presence; Low-Moderate for attribution of specific criminal transactions until forensic corroboration is complete." },
    { label: "Immediate recommendation:", value: "Suspend high-visibility field activities in affected neighbourhoods, activate emergency liaison with host-nation security partners, and begin case handover to authorities with evidence packages (redacted as required)." }
  ];

  summaryFields.forEach(field => {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.text(field.label, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    y = addText(doc, field.value, margin, y, maxWidth);
    y += 5;
  });

  // Investigation Objectives & Scope
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Investigation Objectives & Scope", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setFont("helvetica", "bold");
  doc.text("Primary objective:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Map, verify, and characterise dangerous individuals/groups whose rhetoric or activity directly increase risk to NGO staff in East Baghdad.", margin, y, maxWidth);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Secondary objectives:", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  const secondaryObjectives = [
    "Measure public sentiment toward AAH in East Baghdad and correlate narrative spikes with on-the-ground incidents.",
    "Produce evidence packages fit for legal referral and internal risk mitigation."
  ];
  secondaryObjectives.forEach(obj => {
    y = checkPageBreak(doc, y, 15);
    const lines = doc.splitTextToSize("• " + obj, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
  y += 5;

  // Threat Actor 1
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Threat Actor 1: AndreasRybak", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const actor1Details = [
    ["Handle:", "AndreasRybak"],
    ["Platform(s):", "Dark-web forum (Darknetmarketnoobs)"],
    ["Language:", "English and Arabic (poorly translated - likely non-native)"],
    ["Geographic Focus:", "Iraq and Syria"]
  ];

  actor1Details.forEach(([label, value]) => {
    y = checkPageBreak(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 45, y);
    y += 5;
  });
  y += 3;

  doc.setFont("helvetica", "bold");
  y = addText(doc, "Notable Quotes:", margin, y, maxWidth, 10);
  y += 3;
  
  const actor1Quotes = [
    { date: "02/25", text: "Get some followers together, arm up... and kill whoever it is that threatens you and the people in your group. The Taliban did this..." },
    { date: "01/25", text: "Would be a good one. Was thinking more of getting people over and into the fray. There are thousands of volunteers who want to get involved." },
    { date: "10/24", text: "I have RPG-7s sold on Telegram over in Iraq and Syria" }
  ];

  doc.setFontSize(9);
  actor1Quotes.forEach(quote => {
    y = checkPageBreak(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.text(quote.date, margin, y);
    y += 4;
    doc.setFont("helvetica", "italic");
    y = addText(doc, `"${quote.text}"`, margin, y, maxWidth, 9);
    y += 3;
  });
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Analysis:", margin, y, maxWidth, 10);
  y += 3;
  doc.setFont("helvetica", "normal");
  const actor1Analysis = "Analysis indicates that AndreasRybak presents as a self-motivated violent extremist or arms facilitator operating across dark-web and Telegram ecosystems. His rhetoric combines ideological justification with operational intent, explicitly urging others to 'arm up' and 'kill whoever threatens your group,' while invoking Taliban tactics as a model for local mobilisation. For NGOs and humanitarian staff in East Baghdad, this represents a credible, near-term threat vector that could inspire or coordinate hostile acts.";
  y = addText(doc, actor1Analysis, margin, y, maxWidth);
  y += 10;

  // Threat Actor 2
  y = checkPageBreak(doc, y, 40);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Threat Actor 2: uncle_mo", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const actor2Details = [
    ["Handle:", "uncle_mo"],
    ["Platform(s):", "Dark-web forum Dread / Various chats"],
    ["Language:", "English transliteration with regional phrasing"],
    ["Geographic Focus:", "Basra Governorate"]
  ];

  actor2Details.forEach(([label, value]) => {
    y = checkPageBreak(doc, y, 10);
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 45, y);
    y += 5;
  });
  y += 3;

  doc.setFont("helvetica", "bold");
  y = addText(doc, "Notable Quotes:", margin, y, maxWidth, 10);
  y += 3;
  
  const actor2Quotes = [
    { date: "03/25", text: "there's an active war in my area. No one gets in or out unless you work for the militia, that is what I had to do." },
    { date: "01/25", text: "yes, dread was shut down for a few months. Ironically, i got involved in a legal trouble and while in prison i thought maybe authority seized it and got to know a lot of things going on in the dark" }
  ];

  doc.setFontSize(9);
  actor2Quotes.forEach(quote => {
    y = checkPageBreak(doc, y, 15);
    doc.setFont("helvetica", "bold");
    doc.text(quote.date, margin, y);
    y += 4;
    doc.setFont("helvetica", "italic");
    y = addText(doc, `"${quote.text}"`, margin, y, maxWidth, 9);
    y += 3;
  });
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Analysis:", margin, y, maxWidth, 10);
  y += 3;
  doc.setFont("helvetica", "normal");
  const actor2Analysis = "The user uncle_mo appears to belong to an emerging post-incarceration militant sub-network centred in Basra. This raises a secondary but significant risk: infiltration of NGO operating environments by individuals with divided loyalties or extremist leanings, particularly through military liaisons, drivers, or local guards.";
  y = addText(doc, actor2Analysis, margin, y, maxWidth);
  y += 10;

  // Summary
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Summary", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const summary = "This investigation examined the presence of dangerous actors associated with Asa'ib Ahl al-Haq (AAH) and the broader militia ecosystem operating in Iraq. The search surfaced two distinct threat actors of operational concern. Overall, the investigation confirms that AAH-related extremist sentiment remains active and adaptive, using both open and hidden digital ecosystems to recruit, arm, and legitimise militia operations.\n\nRecommended next steps include maintaining a heightened security posture for all field operations in East Baghdad, immediate re-vetting of local partners with military ties, and continuous monitoring of dark-web chatter for re-emergence of the identified handles or associated narratives.";
  y = addText(doc, summary, margin, y, maxWidth);
};

const exportIranianPetrochemicalsReport = (doc: jsPDF) => {
  const margin = 15;
  const maxWidth = doc.internal.pageSize.getWidth() - (margin * 2);
  let y = margin;

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Iranian Petrochemicals Sanctions-Evasion Network", margin, y, maxWidth, 18);
  y += 3;
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Comprehensive Ecosystem Analysis", margin, y, maxWidth, 12);
  y += 10;

  // Executive Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Executive Summary", margin, y, maxWidth, 14);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const execSummary = "This report maps the current sanctions-evasion ecosystem for Iranian petrochemicals, detailing producer networks, international broker operations, and maritime concealment patterns. Analysis reveals a sophisticated multi-layered system involving front companies, document fraud, and vessel-to-vessel transfers that enable Iran to circumvent international sanctions and generate billions in illicit revenue. Key findings identify specific entities, operational methods, and enforcement gaps that facilitate this trade.";
  y = addText(doc, execSummary, margin, y, maxWidth);
  y += 10;

  // Producer Network
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "1. Iranian Producer Network", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Iran operates one of the world's largest petrochemical complexes, with production concentrated in the Persian Gulf region:", margin, y, maxWidth);
  y += 5;

  const producers = [
    { name: "National Petrochemical Company (NPC)", details: "State-owned holding company controlling majority of Iranian petrochemical assets. Produces 60+ million tons annually including methanol, ammonia, and polyethylene." },
    { name: "Kharg Petrochemical Company", details: "Major methanol producer operating facilities on Kharg Island. Known for involvement in ship-to-ship transfer operations." },
    { name: "Persian Gulf Petrochemical Industries Company", details: "Produces polyethylene and propylene. Extensive links to IRGC-controlled logistics networks." }
  ];

  producers.forEach(producer => {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    y = addText(doc, producer.name, margin, y, maxWidth, 10);
    y += 2;
    doc.setFont("helvetica", "normal");
    y = addText(doc, producer.details, margin, y, maxWidth);
    y += 5;
  });

  // Broker Networks
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "2. International Broker Networks", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  y = addText(doc, "Iranian petrochemicals reach international markets through sophisticated broker networks operating across multiple jurisdictions:", margin, y, maxWidth);
  y += 5;

  const brokers = [
    "UAE-based front companies providing false documentation and transshipment services",
    "Chinese brokers facilitating end-user connections and payment processing",
    "Turkish intermediaries specializing in overland transport and banking services",
    "Malaysian shell companies used for ownership obfuscation and sanctions circumvention"
  ];

  brokers.forEach(broker => {
    y = checkPageBreak(doc, y, 15);
    const lines = doc.splitTextToSize("• " + broker, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
  y += 5;

  // Maritime Concealment
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "3. Maritime Concealment Patterns", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  const maritimePatterns = [
    { method: "AIS Manipulation", description: "Vessels routinely disable or falsify Automatic Identification System transponders to obscure routes and rendezvous points." },
    { method: "Ship-to-Ship Transfers", description: "Products transferred between vessels at sea to break chain of custody. Common locations include waters off Malaysia, UAE, and international zones in South China Sea." },
    { method: "Flag-Hopping", description: "Frequent re-flagging of vessels under flags of convenience (Panama, Liberia, Comoros) to evade tracking and sanctions enforcement." },
    { method: "False Documentation", description: "Bills of lading, certificates of origin, and cargo manifests routinely falsified to disguise Iranian origin and destination." }
  ];

  maritimePatterns.forEach(pattern => {
    y = checkPageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    y = addText(doc, pattern.method, margin, y, maxWidth, 10);
    y += 2;
    doc.setFont("helvetica", "normal");
    y = addText(doc, pattern.description, margin, y, maxWidth);
    y += 5;
  });

  // Financial Mechanisms
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "4. Financial Mechanisms", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const financialMechanisms = [
    "Use of cryptocurrency (primarily Tether/USDT) for cross-border payments to avoid banking scrutiny",
    "Hawala networks for informal value transfer, particularly in UAE and Pakistan",
    "Trade-based money laundering through over- and under-invoicing of legitimate goods",
    "Front companies in multiple jurisdictions to layer transactions and obscure beneficial ownership"
  ];

  financialMechanisms.forEach(mechanism => {
    y = checkPageBreak(doc, y, 15);
    const lines = doc.splitTextToSize("• " + mechanism, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
  y += 5;

  // Enforcement Gaps
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "5. Enforcement Gaps and Challenges", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const challenges = [
    "Limited international coordination: Many jurisdictions lack resources or political will to enforce sanctions",
    "Maritime surveillance limitations: Vast ocean areas and AIS manipulation make tracking difficult",
    "Corporate opacity: Shell company structures and beneficial ownership concealment hamper investigations",
    "Regulatory arbitrage: Networks exploit differences in sanctions regimes across jurisdictions",
    "Resource constraints: Enforcement agencies overwhelmed by volume and sophistication of evasion schemes"
  ];

  challenges.forEach(challenge => {
    y = checkPageBreak(doc, y, 15);
    const lines = doc.splitTextToSize("• " + challenge, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
  y += 10;

  // Recommendations
  y = checkPageBreak(doc, y, 30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  y = addText(doc, "Recommendations", margin, y, maxWidth, 12);
  y += 5;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const recommendations = [
    "Enhanced maritime surveillance using satellite technology and AI-powered AIS analysis",
    "Improved international coordination through multilateral task forces",
    "Stricter beneficial ownership transparency requirements in key transshipment jurisdictions",
    "Targeted sanctions on identified broker networks and facilitators",
    "Increased resources for enforcement agencies and specialized training",
    "Public-private partnerships with shipping industry to improve compliance"
  ];

  recommendations.forEach(rec => {
    y = checkPageBreak(doc, y, 15);
    const lines = doc.splitTextToSize("• " + rec, maxWidth - 5);
    doc.text(lines, margin + 2, y);
    y += lines.length * 5;
  });
};
