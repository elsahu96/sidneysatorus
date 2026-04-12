// Report data structures for investigations

export interface ReportData {
  type: "standard" | "KYC";
  subject: string;
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  content: string;
  subsections?: ReportSection[];
  style?: "normal" | "warning" | "highlight";
}

export const getReportData = (subject: string): ReportData | null => {
  const subjectLower = subject.toLowerCase();
  
  if (subjectLower.includes("roman abramovich")) {
    return getRomanAbramovichReport();
  }
  
  if (subjectLower.includes("russell cherry")) {
    return getRussellCherryReport();
  }
  
  return null;
};

const getRomanAbramovichReport = (): ReportData => {
  return {
    type: "standard",
    subject: "Roman Abramovich",
    sections: [
      {
        title: "Key Findings",
        style: "highlight",
        content: "The Know Your Customer (KYC) investigation into Roman Abramovich reveals significant adverse information, primarily concerning his close ties to the President of the Russian Federation, Vladimir Putin, and his substantial business interests that contribute significantly to the Russian government's revenue. He is identified as a Politically Exposed Person (PEP) and is subject to extensive international sanctions due to his involvement in economic sectors providing substantial revenue to the Russian government, which is deemed responsible for the annexation of Crimea and the destabilization of Ukraine. Allegations of involvement in corruption schemes related to Gazprom PJSC have also been noted. While he holds Russian, Israeli, and Portuguese nationalities, a search for corporate officer roles in the UK Companies House yielded no results."
      },
      {
        title: "1. Personal Details",
        content: "Name: Roman Arkadyevich Abramovich\n\nDate of Birth: 24 October 1966\n\nPlace of Birth: Saratov, Russian Federation\n\nNationalities: Russian, Israeli, Portuguese\n\nKnown Addresses:\n• 1 Lipovaya Aleya, Nemchinovo, Russian Federation\n• Apartment 35.1 1 Waterfront Drive, London SW10 0AA, England\n\nEducation: Moscow State Law University, Gubkin University\n\nReligion: Judaism"
      },
      {
        title: "2. Political Exposure and Affiliations",
        content: "Roman Abramovich is classified as a Politically Exposed Person (PEP) due to his former role as Governor of Chukotka Autonomous Okrug (2000-2008) and his well-documented, long-standing, and close ties to President Vladimir Putin. These connections date back to the late 1990s and are reported to have provided him with privileged access to the president, aiding in the preservation of his considerable wealth. He was part of the circle that supported Putin's ascent to the presidency."
      },
      {
        title: "3. Business Interests and Financial Connections",
        content: "Abramovich holds significant stakes in major Russian companies, which have been identified as providing substantial revenue to the Russian government:\n\nEvraz: He is a major shareholder, directly owning 28.64% of the shares. Evraz is one of Russia's largest taxpayers and supplies raw materials to defense industry companies, including Uralvagonzavod, a producer of tanks.\n\nNorilsk Nickel: He is a shareholder in this Russian company, one of the world's largest palladium producers and a major refined nickel company in the mining sector.\n\nOther Investments: He also owns shares in other significant Russian companies such as Yandex and Renaissance Insurance.\n\nMillhouse Capital: He is identified as the owner of Millhouse Capital.\n\nGazprom PJSC: He has been implicated in corruption schemes related to Gazprom PJSC and its subsidiaries, allegedly playing a role in generating corrupt income for Vladimir Putin and his closest associates.\n\nHis business ventures are stated to have benefited from Russian decision-makers responsible for the annexation of Crimea and the destabilization of Ukraine."
      },
      {
        title: "4. Sanctions and Adverse Information",
        style: "warning",
        content: "Roman Abramovich is subject to a range of sanctions and restrictive measures from multiple jurisdictions, primarily due to his status as a leading Russian businessperson operating in sectors providing substantial revenue to the Russian government, which is responsible for actions against Ukraine:\n\nEU Sanctions: He has been sanctioned by the EU, effective March 15, 2022, leading to asset freezes and travel bans. The EU specifically noted his involvement in economic sectors providing a substantial source of revenue to the Government of the Russian Federation.\n\nUK Sanctions: The UK imposed sanctions on him, including an asset freeze, travel ban, and transport sanctions, effective March 10, 2022. Transport sanctions prohibit ships and aircraft owned, controlled, chartered, or operated by him from entering or overflying the UK.\n\nUkraine Sanctions: Ukraine has also imposed personal, special, economic, and other restrictive measures (sanctions) against him.\n\nOther Designations: He was mentioned in the 2018 CAATSA report on Russian oligarchs. A Director Disqualification Sanction was imposed on April 9, 2025."
      }
    ]
  };
};

const getRussellCherryReport = (): ReportData => {
  return {
    type: "russell-cherry",
    subject: "Russell Cherry",
    sections: [
      {
        title: "Key Findings",
        style: "highlight",
        content: "The investigation into Russell Cherry's X (formerly Twitter) profile reveals a strong affiliation with the UK Independence Party (UKIP) and pronounced political views centered on anti-immigration, pro-Brexit sentiments, and concerns regarding law enforcement. Several posts contain statements that could be considered controversial, particularly those expressing alarmist views on immigration and linking it to potential societal threats and European destabilization."
      },
      {
        title: "Political Affiliations and Views",
        content: "Russell Cherry's X activity clearly indicates a strong alignment with the UK Independence Party (UKIP). His posts frequently reference UKIP candidates and policies:\n\n• He openly states, \"I`m backing Dr Bob for UKIP PCC we need to protect our police from further cuts to numbers and resources. More cops on the streets.\"\n\n• He mentions \"hours of leafleting with CSM Cllr candidate Mathew Torri,\" and meeting \"lots of UKIP supporters on the streets.\"\n\n• He was \"canvassing at WTSS ward with our great #UKIP candidate Helen Adams. Joined by #Suzanne Evans and #Tink.\"\n\nHis political views are consistently expressed across several key areas:\n\nImmigration: Cherry holds very strong, negative views on immigration, frequently expressing concerns about its impact on the UK and Europe. He advocates for stricter controls and questions the motives and authenticity of migrants.\n\nBrexit: He is a firm supporter of Brexit, viewing it as a positive step for the UK, especially in light of perceived struggles in other European countries to cope with migration.\n\nLaw Enforcement and Crime: He frequently criticizes cuts to police numbers and resources, linking this to an increase in crime and a feeling of insecurity among citizens. He also actively engages with local policing issues, such as tackling scrambler bikes and traveller incursions.\n\nLocal Council Matters: As a councillor, he posts about local issues, such as reporting graffiti and requesting improvements to public spaces. He also criticizes what he perceives as \"gerrymandering\" by other councillors."
      },
      {
        title: "Controversial Content",
        style: "warning",
        content: "Several posts made by Russell Cherry contain language and views that could be considered controversial:\n\nAlarmist Immigration Rhetoric:\n\"Wait until some of them rise up with their Kalashnikovs and force Islam on us then you will realise what you have done with your tolerance.\"\n\n\"Europe has gone mad. It is allowing itself to be taken over by an army who have no tanks or guns. The tolerant will lose to the intolerant.\"\n\nConspiracy Theories:\n\"I wouldn`t mind betting that Putin is pulling the strings of Merkle to bring down Europe using uncontrolled immigration as a weapon!\"\n\nCriticism of Pro-Immigration Stances:\n\"Just watched Emma Thompson on Newsnight she is not in touch with reality says we should take these immigrants from Calais.\"\n\n\"Will she put them up? I still have people on my ward who have been on the council waiting list 18 years! Get real Emma.\"\n\nGeneral Distrust of Migrants:\n\"Because there are so many chancers jumping on the bandwagon. And we still have a responsibility to our own people. This should be UK priority.\"\n\n\"Will they jump ahead of you in the council waiting list? There is no spare housing.\"\n\nReporting Offensive Graffiti:\nWhile not controversial in itself, one post mentions him requesting the council to clean graffiti that \"had a swastika & other offensive graffiti,\" indicating his awareness and response to such symbols.\n\nCriticism of EU Officials:\nHe describes democratically elected European governments as \"bending the knee to EU officials who we do not know\" and refers to \"these idiots in charge of Europe.\""
      }
    ]
  };
};
