import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, User, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface XAccount {
  username: string;
  name: string;
  reason: string;
  matchStrength: "strong" | "weak";
  url?: string;
}

interface XAccountSelectorProps {
  onConfirm: (username: string) => void;
  readonly?: boolean;
  selectedUsername?: string;
}

export const XAccountSelector = ({ onConfirm, readonly = false, selectedUsername }: XAccountSelectorProps) => {
  const [selectedAccount, setSelectedAccount] = useState<string | null>(selectedUsername || null);

  const accounts: XAccount[] = [
    {
      username: "russcherry5",
      name: "Cllr Russell Cherry",
      reason: 'The "Cllr" in the name strongly suggests he is a councillor, aligning with the information you provided.',
      matchStrength: "strong",
      url: "https://x.com/russcherry5"
    },
    {
      username: "RussellCherry12",
      name: "Russell Cherry",
      reason: "Name matches but no additional context to verify identity.",
      matchStrength: "weak"
    },
    {
      username: "Marine209902",
      name: "Russell Cherry",
      reason: "Name matches but username suggests different professional background.",
      matchStrength: "weak"
    },
    {
      username: "CherryRuss6187",
      name: "Russ Cherry",
      reason: "Shortened name variant with no additional verification details.",
      matchStrength: "weak"
    },
    {
      username: "1russcherry",
      name: "russ cherry",
      reason: "Lowercase name format with no additional context.",
      matchStrength: "weak"
    },
    {
      username: "CherryRussell14",
      name: "Cherry Russell",
      reason: "Name order reversed, no additional verification information.",
      matchStrength: "weak"
    }
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Potential X Account Matches</h3>
        <p className="text-sm text-muted-foreground">
          {readonly ? "Selected account for investigation" : "Select the account you wish to investigate further"}
        </p>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => (
          <Card
            key={account.username}
            className={cn(
              readonly ? "" : "cursor-pointer hover:border-primary/50",
              "transition-all duration-200",
              selectedAccount === account.username && "border-primary bg-primary/5",
              account.matchStrength === "strong" && "border-primary/30"
            )}
            onClick={() => !readonly && setSelectedAccount(account.username)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full",
                  account.matchStrength === "strong" ? "bg-primary/10" : "bg-muted"
                )}>
                  <User className={cn(
                    "h-5 w-5",
                    account.matchStrength === "strong" ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{account.name}</span>
                    {account.matchStrength === "strong" && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Strong Match
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">@{account.username}</p>
                    {account.url ? (
                      <a
                        href={account.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <ExternalLink className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-foreground">{account.reason}</p>
                </div>

                {selectedAccount === account.username && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                    <Check className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={() => selectedAccount && onConfirm(selectedAccount)}
        disabled={!selectedAccount || readonly}
        className="w-full"
      >
        {readonly ? "Account Selected" : "Proceed with Selected Account"}
      </Button>
    </div>
  );
};
