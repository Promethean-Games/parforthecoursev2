import { Button } from "@/components/ui/button";

interface TableSetupDialogProps {
  hole: number;
  par: number;
  onConfirm: () => void;
}

export function TableSetupDialog({ hole, par, onConfirm }: TableSetupDialogProps) {
  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold" data-testid="text-setup-title">
            Hole {hole} - Par {par}
          </h1>
          <p className="text-xl text-muted-foreground" data-testid="text-setup-instruction">
            Setup the pool table to match the card as shown using stripes and/or solids. Click Ready! when you have finished setting up the table.
          </p>
        </div>

        <Button
          className="w-full min-h-24 text-4xl font-bold tracking-wide"
          onClick={onConfirm}
          data-testid="button-table-ready"
        >
          Ready!
        </Button>
      </div>
    </div>
  );
}
