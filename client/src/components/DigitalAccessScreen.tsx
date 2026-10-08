import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatEditionPrice, type EditionDefinition } from "@/lib/editions";

interface DigitalAccessScreenProps {
  edition: EditionDefinition;
  isPurchasing: boolean;
  error: string | null;
  onPurchase: () => void;
  onUsePhysicalCards: () => void;
  onBack: () => void;
}

export function DigitalAccessScreen({
  edition,
  isPurchasing,
  error,
  onPurchase,
  onUsePhysicalCards,
  onBack,
}: DigitalAccessScreenProps) {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">{edition.name} Digital</h1>
          <p className="text-sm text-muted-foreground">
            Play Par for the Course digitally without physical cards.
          </p>
        </div>

        <p className="text-center text-xl font-semibold">{formatEditionPrice(edition.priceCents)}</p>

        {error && <p className="text-sm text-destructive text-center">{error}</p>}

        <Button
          className="w-full h-12"
          onClick={onPurchase}
          disabled={isPurchasing}
          data-testid="button-purchase-digital-edition"
        >
          {isPurchasing ? "Unlocking..." : "Purchase Digital Edition"}
        </Button>

        <Button
          variant="outline"
          className="w-full h-12"
          onClick={onUsePhysicalCards}
          data-testid="button-i-own-physical-cards"
        >
          I Own the Physical Cards
        </Button>

        <Button variant="ghost" className="w-full" onClick={onBack} data-testid="button-digital-access-back">
          Back
        </Button>
      </Card>
    </div>
  );
}
