import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EditionDefinition } from "@/lib/editions";

interface DigitalExperiencePlaceholderProps {
  edition: EditionDefinition;
  onBack: () => void;
}

export function DigitalExperiencePlaceholder({ edition, onBack }: DigitalExperiencePlaceholderProps) {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold">{edition.name} Digital</h1>
        <p className="text-muted-foreground">
          Digital deck experience placeholder. Entitlement is active for this edition.
        </p>
        <Button onClick={onBack} data-testid="button-digital-placeholder-back">
          Back
        </Button>
      </Card>
    </div>
  );
}
