import type { EditionId } from "@/lib/editions";

export type RulesState =
  | { view: "closed" }
  | { view: "picker" }
  | { view: "edition"; editionId: EditionId | null; fromPicker: boolean; fromGame: boolean };

export interface RulesTransition {
  state: RulesState;
  // True when this transition must trigger one auto-save of the active game.
  save: boolean;
}

export const RULES_CLOSED: RulesState = { view: "closed" };

// Opening while a viewer is already visible is ignored, so repeated taps cannot stack viewers or saves.
export function openRules(
  state: RulesState,
  target: { editionId?: EditionId | null; fromGame?: boolean },
): RulesTransition {
  if (state.view !== "closed") return { state, save: false };
  const fromGame = Boolean(target.fromGame);
  if (target.editionId === undefined) {
    return { state: { view: "picker" }, save: false };
  }
  return {
    state: { view: "edition", editionId: target.editionId, fromPicker: false, fromGame },
    save: fromGame,
  };
}

export function selectRulesEdition(state: RulesState, editionId: EditionId): RulesTransition {
  if (state.view !== "picker") return { state, save: false };
  return { state: { view: "edition", editionId, fromPicker: true, fromGame: false }, save: false };
}

export function closeRules(state: RulesState): RulesTransition {
  if (state.view === "closed") return { state, save: false };
  if (state.view === "picker") return { state: RULES_CLOSED, save: false };
  if (state.fromPicker) return { state: { view: "picker" }, save: false };
  return { state: RULES_CLOSED, save: state.fromGame };
}
