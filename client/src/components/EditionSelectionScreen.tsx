import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EDITIONS, type EditionDefinition } from "@/lib/editions";
import { LOGO_URL } from "@/lib/constants";

interface EditionSelectionScreenProps {
  onSelectEdition: (edition: EditionDefinition) => void;
  onBack: () => void;
}

export function EditionSelectionScreen({ onSelectEdition, onBack }: EditionSelectionScreenProps) {
  return (
    <div className="flex flex-col min-h-screen p-6 pb-8">
      <div className="flex flex-col items-center mb-6">
        <img src={LOGO_URL} alt="Par for the Course" className="w-24 h-auto mb-2" />
        <h1 className="text-2xl font-bold text-center">Select Your Edition</h1>
      </div>

      <div className="space-y-3 flex-1">
        {EDITIONS.map((edition) => (
          <Card key={edition.id} className="p-4">
            <Button
              className="w-full h-12 text-lg"
              onClick={() => onSelectEdition(edition)}
              data-testid={`button-edition-${edition.id}`}
            >
              {edition.name}
            </Button>
          </Card>
        ))}
      </div>

      <Button variant="outline" className="w-full h-12" onClick={onBack} data-testid="button-edition-back">
        Back
      </Button>
    </div>
  );
}
