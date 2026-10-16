import { Button } from "@/components/ui/button";
import { SceneBackdrop } from "@/components/arcade/SceneBackdrop";
import { Card } from "@/components/ui/card";
import { formatEditionPrice, type EditionDefinition } from "@/lib/editions";

interface DigitalAccessScreenProps {
  edition: EditionDefinition;
  editionPriceLabel?: string | null;
  unlockAllPriceLabel?: string | null;
  isPurchasing: boolean;
  error: string | null;
  onPurchase: () => void;
  onUnlockAll: () => void;
  onUsePhysicalCards: () => void;
  onBack: () => void;
  onPreviewRules?: () => void;
}

export function DigitalAccessScreen({
  edition,
  editionPriceLabel,
  unlockAllPriceLabel,
  isPurchasing,
  error,
  onPurchase,
  onUnlockAll,
  onUsePhysicalCards,
  onBack,
  onPreviewRules,
}: DigitalAccessScreenProps) {
  const priceLabel = editionPriceLabel === undefined
    ? formatEditionPrice(edition.priceCents)
    : (editionPriceLabel ?? "Unavailable");
  const unlockAllLabel = unlockAllPriceLabel ? `Unlock All Editions (${unlockAllPriceLabel})` : "Unlock All Editions";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#120b22] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-foreground">
      <SceneBackdrop />

      <Card className="relative z-10 w-full max-w-5xl overflow-hidden border border-amber-400/30 bg-slate-950/80 shadow-[0_0_40px_rgba(251,191,36,0.18)] backdrop-blur-sm">
        <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-200">
              Digital edition
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">{edition.name}</h1>
              <p className="max-w-xl text-base text-slate-300 md:text-lg">{edition.tagline}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-sm font-semibold text-fuchsia-200">
                One-time purchase
              </div>
              <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                Portable anywhere
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Why players choose this edition</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                {edition.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.5)]">
                      ✦
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="rounded-3xl border border-amber-400/30 bg-gradient-to-br from-slate-900 via-slate-950 to-stone-950 p-5 shadow-[0_0_32px_rgba(251,191,36,0.12)]">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-slate-400">Edition price</p>
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-black text-white">{priceLabel}</span>
              </div>

              <div className="mt-5 space-y-3">
                <Button
                  className="h-12 w-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-600 text-base font-semibold text-slate-950 shadow-[0_0_24px_rgba(251,191,36,0.5)] hover:brightness-110"
                  onClick={onPurchase}
                  disabled={isPurchasing}
                  data-testid="button-purchase-digital-edition"
                >
                  {isPurchasing ? "Unlocking..." : `Buy ${edition.name} — ${priceLabel}`}
                </Button>

                <Button
                  variant="secondary"
                  className="h-12 w-full"
                  onClick={onUnlockAll}
                  disabled={isPurchasing}
                  data-testid="button-purchase-unlock-all"
                >
                  {isPurchasing ? "Unlocking..." : unlockAllLabel}
                </Button>

                <Button
                  variant="outline"
                  className="h-12 w-full border-slate-600 bg-slate-900/50 text-slate-200 hover:bg-slate-800"
                  onClick={onUsePhysicalCards}
                  data-testid="button-i-own-physical-cards"
                >
                  I own the physical cards
                </Button>

                {onPreviewRules && (
                  <Button
                    variant="ghost"
                    className="h-10 w-full text-amber-200 underline hover:bg-slate-800 hover:text-white"
                    onClick={onPreviewRules}
                    data-testid="button-preview-rules"
                  >
                    Preview Rules (free)
                  </Button>
                )}

                <Button
                  variant="ghost"
                  className="h-10 w-full text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={onBack}
                  data-testid="button-digital-access-back"
                >
                  Back
                </Button>
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm text-red-200">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">
              All editions are a one-time purchase and let players take Par for the Course with them anywhere — right from their phone.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
