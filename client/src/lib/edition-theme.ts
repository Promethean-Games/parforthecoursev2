import classicArt from "@assets/editions/classic.jpg";
import rerackedArt from "@assets/editions/reracked.jpg";
import sequentialArt from "@assets/editions/sequential.jpg";
import tournamentArt from "@assets/editions/tournament.jpg";
import teedOffArt from "@assets/editions/teed-off.jpg";
import type { EditionId } from "@/lib/editions";
export interface EditionTheme {
  art: string;
  accent: string;
  headerFrom: string;
  headerTo: string;
  buttonText: string;
}

export const EDITION_THEMES: Record<EditionId, EditionTheme> = {
  classic: { art: classicArt, accent: "#22ff4d", headerFrom: "#0c5a22", headerTo: "#052a10", buttonText: "#04210c" },
  reracked: { art: rerackedArt, accent: "#33a1ff", headerFrom: "#0f3f86", headerTo: "#061a40", buttonText: "#031636" },
  sequential: { art: sequentialArt, accent: "#ffc02e", headerFrom: "#7a4a07", headerTo: "#3a2203", buttonText: "#2b1800" },
  tournament: { art: tournamentArt, accent: "#ff3b3b", headerFrom: "#7d0e12", headerTo: "#3a0508", buttonText: "#ffffff" },
  "teed-off": { art: teedOffArt, accent: "#d5dbe6", headerFrom: "#3b4150", headerTo: "#14171e", buttonText: "#0e1117" },
};

