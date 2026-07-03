import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Users, 
  Trophy, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Power, 
  BarChart3, 
  Settings as SettingsIcon,
  Edit2,
  Mail,
  Hash,
  Palette,
  Shuffle,
  Grid3X3,
  Wand2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  AlertCircle,
  Play,
  Search,
  Link2,
  Star,
  Smartphone,
  Unlink
} from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { apiRequest } from "@/lib/queryClient";

interface UniversalPlayer {
  id: number;
  name: string;
  email: string | null;
  contactInfo: string | null;
  handicap: number | null;
  isProvisional: boolean;
  completedTournaments: number;
}

interface DirectorPortalProps {
  onClose: () => void;
}

type NavTab = "dashboard" | "leaderboard" | "players" | "settings";

interface EditPlayerData {
  id: number;
  playerName: string;
  groupName: string;
  universalId: string;
  contactInfo: string;
}

export function DirectorPortal({ onClose }: DirectorPortalProps) {
  const tournament = useTournament();
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerGroup, setNewPlayerGroup] = useState("");
  const [newPlayerUniversalId, setNewPlayerUniversalId] = useState("");
  const [newPlayerContact, setNewPlayerContact] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const playerNameInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<EditPlayerData | null>(null);
  
  // Theme settings
  type DirectorTheme = "default" | "dark-green" | "dark-blue" | "light";
  const [directorTheme, setDirectorTheme] = useState<DirectorTheme>(() => {
    const saved = localStorage.getItem("directorTheme");
    if (saved === "dark-green" || saved === "dark-blue" || saved === "light") {
      return saved;
    }
    return "default";
  });

  // Group management settings
  const [groupSize, setGroupSize] = useState(4);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showGroupTools, setShowGroupTools] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);

  // Universal player search
  const [universalSearchQuery, setUniversalSearchQuery] = useState("");
  const [universalSearchResults, setUniversalSearchResults] = useState<UniversalPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUniversalPlayer, setSelectedUniversalPlayer] = useState<UniversalPlayer | null>(null);
  const [showUniversalSearch, setShowUniversalSearch] = useState(false);

  const handleSearchUniversalPlayers = async (query: string) => {
    setUniversalSearchQuery(query);
    if (query.length < 2) {
      setUniversalSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      const res = await fetch(`/api/universal-players/search?query=${encodeURIComponent(query)}&directorPin=${directorPin}`);
      if (res.ok) {
        const data = await res.json();
        setUniversalSearchResults(data);
      }
    } catch (err) {
      console.error("Search error:", err);
    }
    setIsSearching(false);
  };

  const handleSelectUniversalPlayer = (player: UniversalPlayer) => {
    setSelectedUniversalPlayer(player);
    setNewPlayerName(player.name);
    setNewPlayerContact(player.email || player.contactInfo || "");
    setUniversalSearchQuery("");
    setUniversalSearchResults([]);
    setShowUniversalSearch(false);
  };

  const handleCreateUniversalPlayer = async (): Promise<UniversalPlayer | null> => {
    if (!newPlayerName.trim()) return null;
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      const res = await apiRequest("POST", "/api/universal-players", {
        name: newPlayerName.trim(),
        email: newPlayerContact.includes("@") ? newPlayerContact.trim() : null,
        contactInfo: !newPlayerContact.includes("@") ? newPlayerContact.trim() : null,
        directorPin,
      });
      const player = await res.json();
      setSelectedUniversalPlayer(player);
      return player;
    } catch (err) {
      console.error("Failed to create universal player:", err);
      return null;
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      tournament.refreshLeaderboard();
    }, 5000);
    return () => clearInterval(interval);
  }, [tournament]);

  useEffect(() => {
    localStorage.setItem("directorTheme", directorTheme);
    // Apply theme to portal
    const portal = document.getElementById("director-portal");
    if (portal) {
      portal.classList.remove("theme-default", "theme-dark-green", "theme-dark-blue", "theme-light");
      portal.classList.add(`theme-${directorTheme}`);
    }
  }, [directorTheme]);

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    setIsAdding(true);
    
    // Get or create universal player - use returned value directly to avoid async state issues
    let universalPlayerId = selectedUniversalPlayer?.id;
    if (!universalPlayerId && newPlayerName.trim()) {
      const createdPlayer = await handleCreateUniversalPlayer();
      universalPlayerId = createdPlayer?.id;
    }
    
    const newPlayer = await tournament.addPlayerToTournament(
      newPlayerName.trim(),
      newPlayerGroup.trim() || undefined,
      newPlayerUniversalId.trim() || undefined,
      newPlayerContact.trim() || undefined
    );
    
    // Link to universal player using the universalPlayerId FK
    if (newPlayer && universalPlayerId) {
      try {
        const directorPin = localStorage.getItem("directorPin") || "3141";
        await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/players/${newPlayer.id}/link-universal`, {
          universalPlayerId,
          directorPin,
        });
      } catch (err) {
        console.error("Failed to link universal player:", err);
      }
    }
    
    setNewPlayerName("");
    setNewPlayerGroup("");
    setNewPlayerUniversalId("");
    setNewPlayerContact("");
    setSelectedUniversalPlayer(null);
    setIsAdding(false);
    
    // Refocus the player name input for smooth flow
    setTimeout(() => playerNameInputRef.current?.focus(), 0);
  };

  const handleRemovePlayer = async (playerId: number) => {
    await tournament.removePlayerFromTournament(playerId);
  };

  const handleUnassignDevice = async (playerId: number) => {
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/players/${playerId}/unassign-device`, {
        directorPin,
      });
      await tournament.refreshPlayers();
    } catch (err) {
      console.error("Failed to unassign device:", err);
    }
  };

  const handleCloseTournament = async () => {
    await tournament.closeTournament();
    setShowConfirmClose(false);
  };

  const handleCompleteTournament = async () => {
    setIsCompleting(true);
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/complete`, {
        directorPin,
      });
      setShowConfirmComplete(false);
    } catch (err) {
      console.error("Failed to complete tournament:", err);
    }
    setIsCompleting(false);
  };

  const handleEditPlayer = (player: typeof tournament.allPlayers[0]) => {
    setEditingPlayer({
      id: player.id,
      playerName: player.playerName,
      groupName: player.groupName || "",
      universalId: "",
      contactInfo: "",
    });
  };

  const handleLinkPlayer = async (player: typeof tournament.allPlayers[0]) => {
    try {
      const directorPin = localStorage.getItem("directorPin") || "3141";
      
      const res = await apiRequest("POST", "/api/universal-players", {
        name: player.playerName,
        email: null,
        contactInfo: null,
        directorPin,
      });
      const universalPlayer = await res.json();
      
      await apiRequest("POST", `/api/tournaments/${tournament.roomCode}/players/${player.id}/link-universal`, {
        universalPlayerId: universalPlayer.id,
        directorPin,
      });
      
      await tournament.refreshPlayers();
    } catch (err) {
      console.error("Failed to link player:", err);
    }
  };

  const handleSavePlayer = async () => {
    if (editingPlayer) {
      await tournament.updatePlayer(editingPlayer.id, {
        playerName: editingPlayer.playerName,
        groupName: editingPlayer.groupName || undefined,
        universalId: editingPlayer.universalId || undefined,
        contactInfo: editingPlayer.contactInfo || undefined,
      });
      setEditingPlayer(null);
    }
  };

  // Auto-assign players to groups evenly
  const handleAutoAssignGroups = async () => {
    if (tournament.allPlayers.length === 0) return;
    setIsAutoAssigning(true);
    
    const players = [...tournament.allPlayers];
    const numGroups = Math.ceil(players.length / groupSize);
    const updates: { playerId: number; groupName: string }[] = [];
    
    players.forEach((player, index) => {
      const groupNum = (index % numGroups) + 1;
      updates.push({ 
        playerId: player.id, 
        groupName: `Group ${groupNum}` 
      });
    });
    
    await tournament.batchUpdatePlayerGroups(updates);
    setIsAutoAssigning(false);
  };

  // Shuffle players randomly into groups
  const handleShuffleGroups = async () => {
    if (tournament.allPlayers.length === 0) return;
    setIsShuffling(true);
    
    // Fisher-Yates shuffle
    const players = [...tournament.allPlayers];
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j], players[i]];
    }
    
    const numGroups = Math.ceil(players.length / groupSize);
    const updates: { playerId: number; groupName: string }[] = [];
    
    players.forEach((player, index) => {
      const groupNum = Math.floor(index / groupSize) + 1;
      updates.push({ 
        playerId: player.id, 
        groupName: `Group ${Math.min(groupNum, numGroups)}` 
      });
    });
    
    await tournament.batchUpdatePlayerGroups(updates);
    setIsShuffling(false);
  };

  // Clear all group assignments
  const handleClearGroups = async () => {
    if (tournament.allPlayers.length === 0) return;
    const updates = tournament.allPlayers.map(player => ({
      playerId: player.id,
      groupName: null as string | null,
    }));
    await tournament.batchUpdatePlayerGroups(updates);
  };

  // Start tournament
  const handleStartTournament = async () => {
    setIsStarting(true);
    await tournament.startTournament();
    setIsStarting(false);
  };

  const groupedPlayers = tournament.allPlayers.reduce((acc, player) => {
    const group = player.groupName || "Unassigned";
    if (!acc[group]) acc[group] = [];
    acc[group].push(player);
    return acc;
  }, {} as Record<string, typeof tournament.allPlayers>);

  // Calculate stats
  const totalStrokes = tournament.leaderboard.reduce((sum, e) => sum + e.totalStrokes, 0);
  const holesPlayed = tournament.leaderboard.reduce((sum, e) => sum + e.holesCompleted, 0);
  const averageScore = tournament.leaderboard.length > 0 
    ? (tournament.leaderboard.reduce((sum, e) => sum + e.relativeToPar, 0) / tournament.leaderboard.length).toFixed(1)
    : "0";

  const themeClasses = {
    "default": "bg-background text-foreground",
    "dark-green": "bg-emerald-950 text-emerald-50",
    "dark-blue": "bg-slate-900 text-slate-50",
    "light": "bg-gray-50 text-gray-900",
  };

  return (
    <div 
      id="director-portal"
      className={`flex flex-col min-h-screen ${themeClasses[directorTheme]}`}
    >
      {/* Fixed Header */}
      <div className="sticky top-0 z-20 border-b bg-inherit">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-close-portal">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Tournament Director</h1>
            <p className="text-sm opacity-70">
              {tournament.tournamentInfo?.name || "New Tournament"} 
              {tournament.roomCode && ` • ${tournament.roomCode}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => tournament.refreshLeaderboard()}
            data-testid="button-refresh-leaderboard"
          >
            <RefreshCw className="w-5 h-5" />
          </Button>
        </div>

        {/* Fixed Nav Tabs */}
        <div className="flex border-t">
          <button
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
              activeTab === "dashboard" 
                ? "border-b-2 border-green-500 text-green-600" 
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => setActiveTab("dashboard")}
            data-testid="tab-dashboard"
          >
            <BarChart3 className="w-5 h-5" />
            Dashboard
          </button>
          <button
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
              activeTab === "leaderboard" 
                ? "border-b-2 border-green-500 text-green-600" 
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => setActiveTab("leaderboard")}
            data-testid="tab-leaderboard"
          >
            <Trophy className="w-5 h-5" />
            Leaderboard
          </button>
          <button
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
              activeTab === "players" 
                ? "border-b-2 border-green-500 text-green-600" 
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => setActiveTab("players")}
            data-testid="tab-players"
          >
            <Users className="w-5 h-5" />
            Players
          </button>
          <button
            className={`flex-1 py-3 px-2 flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
              activeTab === "settings" 
                ? "border-b-2 border-green-500 text-green-600" 
                : "opacity-60 hover:opacity-100"
            }`}
            onClick={() => setActiveTab("settings")}
            data-testid="tab-settings"
          >
            <SettingsIcon className="w-5 h-5" />
            Settings
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-20">
        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-4">
            {/* Tournament Status */}
            <Card className="p-4 border-green-500/30 bg-green-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-70">Tournament Status</p>
                  <p className="text-2xl font-bold">
                    {tournament.tournamentInfo?.isStarted ? "IN PROGRESS" : 
                     tournament.tournamentInfo?.isActive ? "SETUP" : "Ended"}
                  </p>
                </div>
                <div className={`w-4 h-4 rounded-full ${
                  tournament.tournamentInfo?.isStarted ? "bg-green-500 animate-pulse" : 
                  tournament.tournamentInfo?.isActive ? "bg-amber-500" : "bg-gray-400"
                }`} />
              </div>
              {tournament.tournamentInfo?.isActive && !tournament.tournamentInfo?.isStarted && (
                <Button
                  onClick={handleStartTournament}
                  disabled={isStarting || tournament.allPlayers.length === 0}
                  className="w-full mt-3 bg-green-600 hover:bg-green-700"
                  data-testid="button-start-tournament"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {isStarting ? "Starting..." : "Start Tournament"}
                </Button>
              )}
              {tournament.tournamentInfo?.isStarted && (
                <p className="text-sm text-green-600 mt-2 text-center font-medium">
                  Players have been notified and are playing!
                </p>
              )}
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{tournament.allPlayers.length}</p>
                <p className="text-xs opacity-70">Total Players</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{Object.keys(groupedPlayers).length}</p>
                <p className="text-xs opacity-70">Groups</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{holesPlayed}</p>
                <p className="text-xs opacity-70">Holes Played</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold">{averageScore}</p>
                <p className="text-xs opacity-70">Avg to Par</p>
              </Card>
            </div>

            {/* Quick Stats */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Quick Stats</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="opacity-70">Total Strokes</span>
                  <span className="font-mono">{totalStrokes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Active Devices</span>
                  <span className="font-mono">
                    {tournament.allPlayers.filter(p => p.deviceId).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-70">Room Code</span>
                  <span className="font-mono font-bold">{tournament.roomCode}</span>
                </div>
              </div>
            </Card>

            {/* Top 3 Leaderboard Preview */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500" />
                Top 3
              </h3>
              <div className="space-y-2">
                {tournament.leaderboard.slice(0, 3).map((entry, index) => (
                  <div
                    key={entry.playerId}
                    className="flex items-center gap-3 p-2 rounded-lg"
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? "bg-yellow-500 text-yellow-950" :
                      index === 1 ? "bg-gray-300 text-gray-700" :
                      "bg-amber-600 text-amber-50"
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex-1 font-medium truncate">{entry.playerName}</span>
                    <span className="font-mono font-bold">
                      {entry.relativeToPar > 0 ? "+" : ""}{entry.relativeToPar}
                    </span>
                  </div>
                ))}
                {tournament.leaderboard.length === 0 && (
                  <p className="text-center opacity-50 py-2">No scores yet</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === "leaderboard" && (
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Full Leaderboard
              </h3>
              <div className="space-y-1">
                {tournament.leaderboard.map((entry, index) => (
                  <div
                    key={entry.playerId}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                    data-testid={`leaderboard-row-${entry.playerId}`}
                  >
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      index === 0 ? "bg-yellow-500 text-yellow-950" :
                      index === 1 ? "bg-gray-300 text-gray-700" :
                      index === 2 ? "bg-amber-600 text-amber-50" :
                      "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                    }`}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{entry.playerName}</p>
                      <p className="text-xs opacity-60">
                        {entry.groupName || "No group"} • {entry.holesCompleted} holes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono text-lg font-bold ${
                        entry.relativeToPar < 0 ? "text-green-600" :
                        entry.relativeToPar > 0 ? "text-red-500" : ""
                      }`}>
                        {entry.relativeToPar > 0 ? "+" : ""}{entry.relativeToPar}
                      </p>
                      <p className="text-xs opacity-60">{entry.totalStrokes} strokes</p>
                    </div>
                  </div>
                ))}
                {tournament.leaderboard.length === 0 && (
                  <p className="text-center opacity-50 py-8">No scores recorded yet</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Players Tab */}
        {activeTab === "players" && (
          <div className="space-y-4">
            {/* Group Management Tools */}
            <Card className="p-4">
              <button
                onClick={() => setShowGroupTools(!showGroupTools)}
                className="w-full flex items-center justify-between"
                data-testid="button-toggle-group-tools"
              >
                <h3 className="font-semibold flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Group Management Tools
                </h3>
                {showGroupTools ? (
                  <ChevronUp className="w-4 h-4 opacity-60" />
                ) : (
                  <ChevronDown className="w-4 h-4 opacity-60" />
                )}
              </button>
              
              {showGroupTools && (
                <div className="mt-4 space-y-4">
                  {/* Group Size Config */}
                  <div className="flex items-center gap-3">
                    <Label htmlFor="group-size" className="text-sm whitespace-nowrap">
                      Players per group:
                    </Label>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setGroupSize(Math.max(2, groupSize - 1))}
                        disabled={groupSize <= 2}
                        data-testid="button-decrease-group-size"
                      >
                        -
                      </Button>
                      <span className="w-8 text-center font-bold text-lg">{groupSize}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setGroupSize(Math.min(8, groupSize + 1))}
                        disabled={groupSize >= 8}
                        data-testid="button-increase-group-size"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      <p className="text-2xl font-bold">{tournament.allPlayers.length}</p>
                      <p className="text-xs opacity-60">Players</p>
                    </div>
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      <p className="text-2xl font-bold">{Object.keys(groupedPlayers).length}</p>
                      <p className="text-xs opacity-60">Groups</p>
                    </div>
                    <div className="p-2 rounded-lg bg-black/5 dark:bg-white/5">
                      <p className="text-2xl font-bold">
                        {Math.ceil(tournament.allPlayers.length / groupSize)}
                      </p>
                      <p className="text-xs opacity-60">Target</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleAutoAssignGroups}
                      disabled={isAutoAssigning || tournament.allPlayers.length === 0}
                      className="flex items-center gap-2"
                      data-testid="button-auto-assign-groups"
                    >
                      <Grid3X3 className="w-4 h-4" />
                      {isAutoAssigning ? "Assigning..." : "Auto-Assign"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleShuffleGroups}
                      disabled={isShuffling || tournament.allPlayers.length === 0}
                      className="flex items-center gap-2"
                      data-testid="button-shuffle-groups"
                    >
                      <Shuffle className="w-4 h-4" />
                      {isShuffling ? "Shuffling..." : "Shuffle"}
                    </Button>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearGroups}
                    disabled={tournament.allPlayers.length === 0}
                    className="w-full text-destructive hover:text-destructive"
                    data-testid="button-clear-groups"
                  >
                    Clear All Groups
                  </Button>

                  {tournament.allPlayers.length === 0 && (
                    <div className="flex items-center gap-2 text-sm opacity-60 justify-center">
                      <AlertCircle className="w-4 h-4" />
                      Add players first to use group tools
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* Add Player Form */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Add Player
              </h3>
              <div className="space-y-3">
                {/* Universal Player Search Toggle */}
                <div className="flex items-center gap-2">
                  <Button
                    variant={showUniversalSearch ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowUniversalSearch(!showUniversalSearch)}
                    className="gap-2"
                    data-testid="button-toggle-universal-search"
                  >
                    <Search className="w-4 h-4" />
                    {showUniversalSearch ? "Hide Search" : "Find Existing Player"}
                  </Button>
                  {selectedUniversalPlayer && (
                    <div className="flex items-center gap-2 px-2 py-1 bg-green-500/20 text-green-700 dark:text-green-400 rounded text-sm">
                      <Link2 className="w-3 h-3" />
                      <span className="truncate max-w-32">{selectedUniversalPlayer.name}</span>
                      {selectedUniversalPlayer.handicap !== null && (
                        <span className="font-mono text-xs">
                          ({selectedUniversalPlayer.isProvisional ? "P" : ""}{selectedUniversalPlayer.handicap?.toFixed(1)})
                        </span>
                      )}
                      <button 
                        onClick={() => setSelectedUniversalPlayer(null)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {/* Universal Player Search Results */}
                {showUniversalSearch && (
                  <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                      <Input
                        value={universalSearchQuery}
                        onChange={(e) => handleSearchUniversalPlayers(e.target.value)}
                        placeholder="Search by name or email..."
                        className="pl-9"
                        data-testid="input-universal-search"
                      />
                    </div>
                    {isSearching && <p className="text-xs opacity-60">Searching...</p>}
                    {universalSearchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {universalSearchResults.map(player => (
                          <button
                            key={player.id}
                            onClick={() => handleSelectUniversalPlayer(player)}
                            className="w-full text-left p-2 rounded hover:bg-muted flex items-center gap-2"
                            data-testid={`button-select-universal-${player.id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{player.name}</p>
                              <p className="text-xs opacity-60 truncate">{player.email || "No email"}</p>
                            </div>
                            {player.handicap !== null ? (
                              <div className="text-right">
                                <span className="font-mono text-sm font-bold">
                                  {player.isProvisional && <Star className="w-3 h-3 inline mr-1 text-amber-500" />}
                                  {player.handicap.toFixed(1)}
                                </span>
                                <p className="text-xs opacity-60">{player.completedTournaments} tournaments</p>
                              </div>
                            ) : (
                              <span className="text-xs opacity-60">New</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {universalSearchQuery.length >= 2 && universalSearchResults.length === 0 && !isSearching && (
                      <p className="text-xs opacity-60 text-center py-2">No matching players found</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Input
                    ref={playerNameInputRef}
                    autoFocus
                    value={newPlayerName}
                    onChange={(e) => {
                      setNewPlayerName(e.target.value);
                      if (selectedUniversalPlayer && e.target.value !== selectedUniversalPlayer.name) {
                        setSelectedUniversalPlayer(null);
                      }
                    }}
                    placeholder="Player name *"
                    className="flex-1"
                    data-testid="input-director-player-name"
                  />
                  <Input
                    value={newPlayerGroup}
                    onChange={(e) => setNewPlayerGroup(e.target.value)}
                    placeholder="Group"
                    className="w-24"
                    data-testid="input-director-player-group"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <Input
                      value={newPlayerUniversalId}
                      onChange={(e) => setNewPlayerUniversalId(e.target.value)}
                      placeholder="Universal ID"
                      className="pl-9"
                      data-testid="input-director-player-uid"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                    <Input
                      value={newPlayerContact}
                      onChange={(e) => setNewPlayerContact(e.target.value)}
                      placeholder="Contact info"
                      className="pl-9"
                      data-testid="input-director-player-contact"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleAddPlayer}
                  disabled={isAdding || !newPlayerName.trim()}
                  className="w-full"
                  data-testid="button-director-add-player"
                >
                  {isAdding ? "Adding..." : selectedUniversalPlayer ? "Add Player (Linked)" : "Add Player (New)"}
                </Button>
              </div>
            </Card>

            {/* Player List */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                All Players ({tournament.allPlayers.length})
              </h3>
              {Object.entries(groupedPlayers).map(([groupName, players]) => (
                <div key={groupName} className="mb-4">
                  <h4 className="text-sm font-medium opacity-70 mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {groupName} ({players.length})
                  </h4>
                  <div className="space-y-1">
                    {players.map(player => (
                      <div
                        key={player.id}
                        className="flex items-center gap-2 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{player.playerName}</p>
                            {player.universalPlayerId ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title="Linked for handicapping">
                                <Link2 className="w-3 h-3" />
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title="Not linked - no handicap tracking">
                                <AlertCircle className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-xs opacity-60 flex items-center gap-1">
                            {player.deviceId ? (
                              <>
                                <Smartphone className="w-3 h-3" />
                                Device assigned
                              </>
                            ) : (
                              "No device"
                            )}
                          </p>
                        </div>
                        {player.deviceId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-600 hover:text-orange-700"
                            onClick={() => handleUnassignDevice(player.id)}
                            title="Unassign device"
                            data-testid={`button-unassign-device-${player.id}`}
                          >
                            <Unlink className="w-4 h-4" />
                          </Button>
                        )}
                        {!player.universalPlayerId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700"
                            onClick={() => handleLinkPlayer(player)}
                            title="Link for handicap tracking"
                            data-testid={`button-link-player-${player.id}`}
                          >
                            <Link2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEditPlayer(player)}
                          data-testid={`button-edit-player-${player.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemovePlayer(player.id)}
                          data-testid={`button-remove-player-${player.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {tournament.allPlayers.length === 0 && (
                <p className="text-center opacity-50 py-4">No players added yet</p>
              )}
            </Card>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {/* Theme Selection */}
            <Card className="p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Director Portal Theme
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`p-4 rounded-lg border-2 transition-all ${
                    directorTheme === "default" 
                      ? "border-green-500 bg-green-500/10" 
                      : "border-transparent hover:border-gray-300"
                  }`}
                  onClick={() => setDirectorTheme("default")}
                  data-testid="theme-default"
                >
                  <div className="w-full h-8 rounded bg-gradient-to-r from-gray-800 to-gray-600 mb-2" />
                  <p className="text-sm font-medium">PftC Default</p>
                </button>
                <button
                  className={`p-4 rounded-lg border-2 transition-all ${
                    directorTheme === "dark-green" 
                      ? "border-green-500 bg-green-500/10" 
                      : "border-transparent hover:border-gray-300"
                  }`}
                  onClick={() => setDirectorTheme("dark-green")}
                  data-testid="theme-dark-green"
                >
                  <div className="w-full h-8 rounded bg-gradient-to-r from-emerald-900 to-emerald-700 mb-2" />
                  <p className="text-sm font-medium">Dark Green</p>
                </button>
                <button
                  className={`p-4 rounded-lg border-2 transition-all ${
                    directorTheme === "dark-blue" 
                      ? "border-green-500 bg-green-500/10" 
                      : "border-transparent hover:border-gray-300"
                  }`}
                  onClick={() => setDirectorTheme("dark-blue")}
                  data-testid="theme-dark-blue"
                >
                  <div className="w-full h-8 rounded bg-gradient-to-r from-slate-900 to-slate-700 mb-2" />
                  <p className="text-sm font-medium">Dark Blue</p>
                </button>
                <button
                  className={`p-4 rounded-lg border-2 transition-all ${
                    directorTheme === "light" 
                      ? "border-green-500 bg-green-500/10" 
                      : "border-transparent hover:border-gray-300"
                  }`}
                  onClick={() => setDirectorTheme("light")}
                  data-testid="theme-light"
                >
                  <div className="w-full h-8 rounded bg-gradient-to-r from-gray-100 to-gray-300 mb-2" />
                  <p className="text-sm font-medium">Light</p>
                </button>
              </div>
            </Card>

            {/* Tournament Controls */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Power className="w-4 h-4" />
                Tournament Controls
              </h3>
              
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-black/5 dark:bg-white/5">
                  <p className="text-sm opacity-70 mb-1">Room Code</p>
                  <p className="text-2xl font-mono font-bold tracking-wider">
                    {tournament.roomCode || "—"}
                  </p>
                </div>

                {/* Complete Tournament - Save Results & Update Handicaps */}
                {showConfirmComplete ? (
                  <div className="space-y-2 p-3 border border-green-500/30 rounded-lg bg-green-500/5">
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Complete Tournament?
                    </p>
                    <p className="text-sm opacity-70">
                      This will save all player results and update their handicaps based on their performance.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowConfirmComplete(false)}
                        disabled={isCompleting}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={handleCompleteTournament}
                        disabled={isCompleting}
                        data-testid="button-confirm-complete-tournament"
                      >
                        {isCompleting ? "Saving..." : "Complete & Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-green-500/50 text-green-600 hover:bg-green-500/10"
                    onClick={() => setShowConfirmComplete(true)}
                    disabled={!tournament.tournamentInfo?.isStarted || !tournament.tournamentInfo?.isActive}
                    data-testid="button-complete-tournament"
                  >
                    <Trophy className="w-4 h-4" />
                    Complete Tournament & Save Handicaps
                  </Button>
                )}

                {showConfirmClose ? (
                  <div className="space-y-2">
                    <p className="text-sm opacity-70">
                      Are you sure you want to end this tournament? Players will no longer be able to submit scores.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowConfirmClose(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleCloseTournament}
                        data-testid="button-confirm-close-tournament"
                      >
                        End Tournament
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowConfirmClose(true)}
                    disabled={!tournament.tournamentInfo?.isActive}
                    data-testid="button-close-tournament"
                  >
                    {tournament.tournamentInfo?.isActive ? "End Tournament" : "Tournament Ended"}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Edit Player Dialog */}
      <Dialog open={!!editingPlayer} onOpenChange={(open) => !open && setEditingPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Player</DialogTitle>
          </DialogHeader>
          {editingPlayer && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Player Name</Label>
                <Input
                  value={editingPlayer.playerName}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, playerName: e.target.value })}
                  data-testid="input-edit-player-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Group</Label>
                <Input
                  value={editingPlayer.groupName}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, groupName: e.target.value })}
                  placeholder="Optional"
                  data-testid="input-edit-player-group"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Universal ID
                </Label>
                <Input
                  value={editingPlayer.universalId}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, universalId: e.target.value })}
                  placeholder="Unique identifier"
                  data-testid="input-edit-player-uid"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contact Info
                </Label>
                <Input
                  value={editingPlayer.contactInfo}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, contactInfo: e.target.value })}
                  placeholder="Email or phone"
                  data-testid="input-edit-player-contact"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditingPlayer(null)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSavePlayer}
                  data-testid="button-save-player"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
