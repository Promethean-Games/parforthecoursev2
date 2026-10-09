import { Button } from "@/components/ui/button";
import { EDITIONS, type EditionDefinition } from "@/lib/editions";
import { LOGO_URL } from "@/lib/constants";

const editionButtonStyles: Record<EditionDefinition["id"], string> = {
  classic: "bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500 text-white shadow-lg shadow-emerald-900/30 border border-emerald-300",
  reracked: "bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-900/30 border border-sky-300",
  sequential: "bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-400 text-slate-900 shadow-lg shadow-amber-900/30 border border-yellow-200",
  tournament: "bg-gradient-to-r from-red-600 via-red-500 to-rose-500 text-white shadow-lg shadow-red-900/30 border border-red-300",
  "teed-off": "bg-gradient-to-r from-zinc-950 via-zinc-800 to-zinc-100 text-white shadow-lg shadow-zinc-900/30 border border-zinc-300",
};

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
          <Button
            key={edition.id}
            className={`w-full h-14 text-lg font-semibold rounded-xl transition-transform hover:scale-[1.01] ${editionButtonStyles[edition.id]}`}
            onClick={() => onSelectEdition(edition)}
            data-testid={`button-edition-${edition.id}`}
          >
            {edition.name}
          </Button>
        ))}
      </div>

      <Button variant="outline" className="w-full h-12 mt-4" onClick={onBack} data-testid="button-edition-back">
        Back
      </Button>
    </div>
  );
}
