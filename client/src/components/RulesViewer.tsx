import { useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getEditionRules,
  RULES_EDITION_ORDER,
  RULES_EDITION_NAMES,
  type RuleBlock,
  type RuleItem,
} from "@/data/edition-rules";
import type { EditionId } from "@/lib/editions";
import type { RulesState } from "@/lib/rules-session";

function Item({ item }: { item: RuleItem }) {
  return (
    <>
      {item.label && <strong className="font-semibold">{item.label}. </strong>}
      {item.text}
    </>
  );
}

function Block({ block }: { block: RuleBlock }) {
  if (block.kind === "paragraph") {
    return (
      <div className="space-y-1">
        <p>
          {block.label && <strong className="font-semibold">{block.label}: </strong>}
          {block.text}
        </p>
        {block.note && <p className="text-sm text-muted-foreground">{block.note}</p>}
      </div>
    );
  }
  const List = block.ordered ? "ol" : "ul";
  return (
    <List className={block.ordered ? "list-decimal pl-5 space-y-2" : "list-disc pl-5 space-y-2"}>
      {block.items.map((item) => (
        <li key={item.label ?? item.text}>
          <Item item={item} />
        </li>
      ))}
    </List>
  );
}

interface RulesViewerProps {
  editionId?: string | null;
  onClose: () => void;
}

export function RulesViewer({ editionId, onClose }: RulesViewerProps) {
  const { editionName, ruleset } = getEditionRules(editionId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const jumpTo = (sectionId: string) => {
    document.getElementById(`rules-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [editionId]);

  return (
    <div
      ref={scrollRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
      className="fixed inset-0 z-[60] overflow-y-auto bg-background"
      data-testid="rules-viewer"
    >
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Button size="icon" variant="outline" onClick={onClose} aria-label="Close rules" data-testid="button-rules-close">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">How to Play</p>
          <h1 id="rules-title" className="truncate text-xl font-bold" data-testid="text-rules-edition">
            {editionName}
          </h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl select-text space-y-6 p-4 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <Card className="space-y-2 border-primary/40 p-4" data-testid="rules-quick-reference">
          <h2 className="text-lg font-bold">Quick Reference</h2>
          <ul className="space-y-2 text-sm">
            {ruleset.quickReference.map((item) => (
              <li key={item.label ?? item.text}>
                <Item item={item} />
              </li>
            ))}
          </ul>
        </Card>

        <nav aria-label="Rules sections" className="flex flex-wrap gap-2">
          {ruleset.sections.map((section) => (
            <Button
              key={section.id}
              size="sm"
              variant="secondary"
              onClick={() => jumpTo(section.id)}
              data-testid={`button-rules-jump-${section.id}`}
            >
              {section.title}
            </Button>
          ))}
        </nav>

        {ruleset.sections.map((section) => (
          <section key={section.id} id={`rules-${section.id}`} className="scroll-mt-20 space-y-3">
            <h2 className="text-lg font-bold">{section.title}</h2>
            <div className="space-y-3 leading-relaxed">
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}

interface RulesEditionPickerProps {
  onSelect: (editionId: EditionId) => void;
  onClose: () => void;
}

export function RulesEditionPicker({ onSelect, onClose }: RulesEditionPickerProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-picker-title"
      className="fixed inset-0 z-[60] overflow-y-auto bg-background"
      data-testid="rules-picker"
    >
      <header className="sticky top-0 flex items-center gap-3 border-b bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button size="icon" variant="outline" onClick={onClose} aria-label="Close rules" data-testid="button-rules-picker-close">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 id="rules-picker-title" className="text-xl font-bold">
          How to Play
        </h1>
      </header>
      <main className="mx-auto w-full max-w-md space-y-3 p-4">
        <p className="text-sm text-muted-foreground">Choose an edition to read its rules. Rules are free for every edition.</p>
        {RULES_EDITION_ORDER.map((id) => (
          <Button
            key={id}
            variant="outline"
            className="h-14 w-full justify-between text-lg"
            onClick={() => onSelect(id)}
            data-testid={`button-rules-edition-${id}`}
          >
            {RULES_EDITION_NAMES[id]}
            <ChevronRight className="h-5 w-5" />
          </Button>
        ))}
      </main>
    </div>
  );
}

function stateDepth(state: RulesState): number {
  if (state.view === "closed") return 0;
  if (state.view === "picker") return 1;
  return state.fromPicker ? 2 : 1;
}

interface RulesOverlayProps {
  state: RulesState;
  onSelectEdition: (editionId: EditionId) => void;
  onClose: () => void;
}

// Renders over the current screen (so that screen's state is untouched) and ties it to browser/Android back.
export function RulesOverlay({ state, onSelectEdition, onClose }: RulesOverlayProps) {
  const pushed = useRef(0);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const depth = stateDepth(state);

  useEffect(() => {
    while (pushed.current < depth) {
      window.history.pushState({ rulesViewer: true }, "");
      pushed.current += 1;
    }
    if (pushed.current > depth) pushed.current = depth;
  }, [depth]);

  useEffect(() => {
    const onPopState = () => {
      closingRef.current = false;
      if (pushed.current === 0) return;
      pushed.current -= 1;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const requestClose = () => {
    if (pushed.current > 0) {
      // Ignore repeat taps until the pending popstate arrives, so we never pop extra history entries.
      if (closingRef.current) return;
      closingRef.current = true;
      window.history.back();
    } else {
      onClose();
    }
  };

  if (state.view === "closed") return null;
  if (state.view === "picker") return <RulesEditionPicker onSelect={onSelectEdition} onClose={requestClose} />;
  return <RulesViewer editionId={state.editionId} onClose={requestClose} />;
}
