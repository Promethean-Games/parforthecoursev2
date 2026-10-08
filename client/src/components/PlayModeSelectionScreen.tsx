import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { EditionDefinition } from "@/lib/editions";
import type { PlayMode } from "@/lib/play-mode";

interface PlayModeSelectionScreenProps {
  edition: EditionDefinition;
  onSelectMode: (mode: PlayMode) => void;
  onBack: () => void;
}

export function PlayModeSelectionScreen({ edition, onSelectMode, onBack }: PlayModeSelectionScreenProps) {
  return (
    <div className="flex flex-col min-h-screen p-6 pb-8">
      <div className="mb-6 text-center space-y-1">
        <p className="text-sm text-muted-foreground">Edition</p>
        <h1 className="text-2xl font-bold">{edition.name}</h1>
        <h2 className="text-lg font-semibold">How are you playing?</h2>
      </div>

      <div className="space-y-4 flex-1">
        <Card className="p-4 space-y-3">
          <Button
            className="w-full h-12 text-lg"
            onClick={() => onSelectMode("physical")}
            data-testid="button-mode-physical"
          >
            Physical Cards
          </Button>
          <p className="text-sm text-muted-foreground text-center">I own the physical cards.</p>
        </Card>

        <Card className="p-4 space-y-3">
          <Button
            variant="outline"
            className="w-full h-12 text-lg"
            onClick={() => onSelectMode("digital")}
            data-testid="button-mode-digital"
          >
            Digital Cards
          </Button>
          <p className="text-sm text-muted-foreground text-center">Play using the digital card deck.</p>
        </Card>
      </div>

      <Button variant="outline" className="w-full h-12" onClick={onBack} data-testid="button-mode-back">
        Back
      </Button>
    </div>
  );
}
