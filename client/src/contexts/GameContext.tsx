import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { Player, HoleScore, GameSession, Settings, SetupTime } from "@shared/schema";
import { PLAYER_COLORS } from "@/lib/constants";
import type { EditionId } from "@/lib/editions";
import type { PlayMode } from "@/lib/play-mode";

interface GameState {
  players: Player[];
  currentHole: number;
  currentPlayerIndex: number;
  scores: Record<string, HoleScore[]>;
  isComplete: boolean;
  settings: Settings;
  selectedEditionId: EditionId;
  playMode: PlayMode;
}

interface GameContextValue extends GameState {
  addPlayer: (name: string, position?: number) => void;
  removePlayer: (id: string) => void;
  updatePlayerName: (id: string, name: string) => void;
  updatePlayerColor: (id: string, color: string) => void;
  movePlayer: (id: string, direction: "up" | "down") => void;
  startGame: () => void;
  updateScore: (playerId: string, hole: number, score: Partial<HoleScore>) => void;
  nextCard: () => void;
  previousPlayer: () => void;
  nextPlayer: () => void;
  endGame: () => void;
  resetGame: () => void;
  saveGame: (slot: string) => void;
  loadGame: (slot: string) => void;
  getSavedGames: () => Record<string, GameSession>;
  renameSlot: (oldSlot: string, newSlot: string) => void;
  deleteSlot: (slot: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  undo: () => void;
  setParForAllPlayers: (hole: number, par: number) => void;
  recordSetupTime: (setupTime: SetupTime) => void;
  getSetupTimes: () => SetupTime[];
  setGameExperience: (editionId: EditionId, playMode: PlayMode) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

const LEGACY_DEFAULT_EDITION: EditionId = "classic";
const LEGACY_DEFAULT_MODE: PlayMode = "physical";
const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  leftHandedMode: false,
  autoSave: true,
};

function toGameState(raw: unknown): GameState {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Partial<GameState>;

  return {
    players: Array.isArray(parsed.players) ? parsed.players : [],
    currentHole: typeof parsed.currentHole === "number" ? parsed.currentHole : 1,
    currentPlayerIndex: typeof parsed.currentPlayerIndex === "number" ? parsed.currentPlayerIndex : 0,
    scores: parsed.scores && typeof parsed.scores === "object" ? parsed.scores : {},
    isComplete: Boolean(parsed.isComplete),
    settings: parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : { ...DEFAULT_SETTINGS },
    selectedEditionId: parsed.selectedEditionId || LEGACY_DEFAULT_EDITION,
    playMode: parsed.playMode || LEGACY_DEFAULT_MODE,
  };
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem("currentGame") : null;
      if (saved) {
        try {
          return toGameState(JSON.parse(saved));
        } catch {
          // Fall back to default state
        }
      }
    } catch {
      // Ignore storage issues from restricted contexts.
    }

    return {
      players: [],
      currentHole: 1,
      currentPlayerIndex: 0,
      scores: {},
      isComplete: false,
      settings: { ...DEFAULT_SETTINGS },
      selectedEditionId: LEGACY_DEFAULT_EDITION,
      playMode: LEGACY_DEFAULT_MODE,
    };
  });

  const [history, setHistory] = useState<GameState[]>([]);

  useEffect(() => {
    if (gameState.settings.autoSave && gameState.players.length > 0) {
      localStorage.setItem("currentGame", JSON.stringify(gameState));
      const games = JSON.parse(localStorage.getItem("savedGames") || "{}");
      games["__autosave__"] = {
        id: "autosave",
        ...gameState,
        createdAt: games["__autosave__"]?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("savedGames", JSON.stringify(games));
    }
  }, [gameState]);

  const saveHistory = (newState: GameState) => {
    setHistory((prev) => [...prev.slice(-9), gameState]);
    setGameState(newState);
  };

  const addPlayer = (name: string, position?: number) => {
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name,
      color: PLAYER_COLORS[gameState.players.length % PLAYER_COLORS.length],
      order: position ?? gameState.players.length,
    };

    setGameState((prev) => {
      let newPlayers: Player[];

      if (position !== undefined && position >= 0 && position < prev.players.length) {
        newPlayers = [
          ...prev.players.slice(0, position),
          newPlayer,
          ...prev.players.slice(position),
        ].map((player, index) => ({ ...player, order: index }));
      } else {
        newPlayers = [...prev.players, newPlayer];
      }

      return {
        ...prev,
        players: newPlayers,
        scores: { ...prev.scores, [newPlayer.id]: [] },
      };
    });
  };

  const removePlayer = (id: string) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.filter((player) => player.id !== id).map((player, index) => ({ ...player, order: index })),
    }));
  };

  const updatePlayerName = (id: string, name: string) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((player) => (player.id === id ? { ...player, name } : player)),
    }));
  };

  const updatePlayerColor = (id: string, color: string) => {
    setGameState((prev) => ({
      ...prev,
      players: prev.players.map((player) => (player.id === id ? { ...player, color } : player)),
    }));
  };

  const movePlayer = (id: string, direction: "up" | "down") => {
    setGameState((prev) => {
      const players = [...prev.players];
      const index = players.findIndex((player) => player.id === id);
      if (index === -1) return prev;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= players.length) return prev;

      [players[index], players[newIndex]] = [players[newIndex], players[index]];
      return {
        ...prev,
        players: players.map((player, playerIndex) => ({ ...player, order: playerIndex })),
      };
    });
  };

  const startGame = () => {
    setGameState((prev) => ({
      ...prev,
      currentHole: 1,
      currentPlayerIndex: 0,
      isComplete: false,
    }));
  };

  const updateScore = (playerId: string, hole: number, scoreUpdate: Partial<HoleScore>) => {
    saveHistory(gameState);
    setGameState((prev) => {
      const playerScores = prev.scores[playerId] || [];
      const holeIndex = playerScores.findIndex((score) => score.hole === hole);

      let newScores: HoleScore[];
      if (holeIndex >= 0) {
        newScores = playerScores.map((score, index) =>
          index === holeIndex ? { ...score, ...scoreUpdate } : score,
        );
      } else {
        newScores = [
          ...playerScores,
          {
            hole,
            par: scoreUpdate.par ?? 3,
            strokes: scoreUpdate.strokes ?? 0,
            scratches: scoreUpdate.scratches ?? 0,
            penalties: scoreUpdate.penalties ?? 0,
          },
        ];
      }

      return {
        ...prev,
        scores: { ...prev.scores, [playerId]: newScores },
      };
    });
  };

  const nextCard = () => {
    saveHistory(gameState);
    setGameState((prev) => {
      const nextPlayerIndex = (prev.currentPlayerIndex + 1) % prev.players.length;
      const nextHole = nextPlayerIndex === 0 ? prev.currentHole + 1 : prev.currentHole;

      return {
        ...prev,
        currentPlayerIndex: nextPlayerIndex,
        currentHole: nextHole,
      };
    });
  };

  const previousPlayer = () => {
    setGameState((prev) => ({
      ...prev,
      currentPlayerIndex:
        prev.currentPlayerIndex === 0 ? prev.players.length - 1 : prev.currentPlayerIndex - 1,
    }));
  };

  const nextPlayer = () => {
    setGameState((prev) => ({
      ...prev,
      currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
    }));
  };

  const endGame = () => {
    saveHistory(gameState);
    setGameState((prev) => ({ ...prev, isComplete: true }));
  };

  const resetGame = () => {
    setGameState((prev) => ({
      players: [],
      currentHole: 1,
      currentPlayerIndex: 0,
      scores: {},
      isComplete: false,
      settings: prev.settings,
      selectedEditionId: LEGACY_DEFAULT_EDITION,
      playMode: LEGACY_DEFAULT_MODE,
    }));
    setHistory([]);
  };

  const setGameExperience = (editionId: EditionId, playMode: PlayMode) => {
    setGameState((prev) => ({
      ...prev,
      selectedEditionId: editionId,
      playMode,
    }));
  };

  const saveGame = (slot: string) => {
    const games = JSON.parse(localStorage.getItem("savedGames") || "{}");
    games[slot] = {
      id: crypto.randomUUID(),
      ...gameState,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem("savedGames", JSON.stringify(games));
  };

  const loadGame = (slot: string) => {
    const games = JSON.parse(localStorage.getItem("savedGames") || "{}");
    if (games[slot]) {
      setGameState(toGameState(games[slot]));
    }
  };

  const getSavedGames = () => {
    return JSON.parse(localStorage.getItem("savedGames") || "{}");
  };

  const renameSlot = (oldSlot: string, newSlot: string) => {
    const games = JSON.parse(localStorage.getItem("savedGames") || "{}");
    if (games[oldSlot] && oldSlot !== newSlot) {
      games[newSlot] = { ...games[oldSlot], updatedAt: new Date().toISOString() };
      delete games[oldSlot];
      localStorage.setItem("savedGames", JSON.stringify(games));
    }
  };

  const deleteSlot = (slot: string) => {
    const games = JSON.parse(localStorage.getItem("savedGames") || "{}");
    if (games[slot]) {
      delete games[slot];
      localStorage.setItem("savedGames", JSON.stringify(games));
    }
  };

  const updateSettings = (settings: Partial<Settings>) => {
    setGameState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));
  };

  const undo = () => {
    if (history.length > 0) {
      const previousState = history[history.length - 1];
      setGameState(previousState);
      setHistory((prev) => prev.slice(0, -1));
    }
  };

  const setParForAllPlayers = (hole: number, par: number) => {
    saveHistory(gameState);
    setGameState((prev) => {
      const newScores = { ...prev.scores };

      prev.players.forEach((player) => {
        const playerScores = newScores[player.id] || [];
        const holeIndex = playerScores.findIndex((score) => score.hole === hole);

        if (holeIndex >= 0) {
          newScores[player.id] = playerScores.map((score, index) =>
            index === holeIndex ? { ...score, par } : score,
          );
        } else {
          newScores[player.id] = [
            ...playerScores,
            { hole, par, strokes: 0, scratches: 0, penalties: 0 },
          ];
        }
      });

      return { ...prev, scores: newScores };
    });
  };

  const recordSetupTime = (setupTime: SetupTime) => {
    const times = JSON.parse(localStorage.getItem("setupTimes") || "[]");
    times.push(setupTime);
    localStorage.setItem("setupTimes", JSON.stringify(times));
  };

  const getSetupTimes = (): SetupTime[] => {
    return JSON.parse(localStorage.getItem("setupTimes") || "[]");
  };

  return (
    <GameContext.Provider
      value={{
        ...gameState,
        addPlayer,
        removePlayer,
        updatePlayerName,
        updatePlayerColor,
        movePlayer,
        startGame,
        updateScore,
        nextCard,
        previousPlayer,
        nextPlayer,
        endGame,
        resetGame,
        saveGame,
        loadGame,
        getSavedGames,
        renameSlot,
        deleteSlot,
        updateSettings,
        undo,
        setParForAllPlayers,
        recordSetupTime,
        getSetupTimes,
        setGameExperience,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
