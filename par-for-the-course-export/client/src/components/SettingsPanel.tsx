import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trophy, LogOut, Users, Shield } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { PlayerSelectionDialog } from "./PlayerSelectionDialog";
import { DirectorPortal } from "./DirectorPortal";
import type { Settings, Player } from "@shared/schema";

interface SettingsPanelProps {
  settings: Settings;
  players: Player[];
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onAddPlayer: (name: string, position?: number) => void;
  onEndGame: () => void;
}

export function SettingsPanel({ settings, players, onUpdateSettings, onAddPlayer, onEndGame }: SettingsPanelProps) {
  const [newPlayerName, setNewPlayerName] = useState("");
  const [insertPosition, setInsertPosition] = useState<string>("end");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [titleTapCount, setTitleTapCount] = useState(0);
  const [showDirectorPortal, setShowDirectorPortal] = useState(false);
  const [directorPinInput, setDirectorPinInput] = useState("");
  const [showPinPrompt, setShowPinPrompt] = useState(false);

  const tournament = useTournament();

  const handleAddPlayer = () => {
    const name = newPlayerName.trim() || `Player ${players.length + 1}`;
    const position = insertPosition === "end" ? undefined : parseInt(insertPosition);
    onAddPlayer(name, position);
    setNewPlayerName("");
    setInsertPosition("end");
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) return;
    setJoinError(null);
    const success = await tournament.joinRoom(roomCodeInput.trim());
    if (success) {
      setRoomCodeInput("");
      setShowPlayerSelection(true);
    } else {
      setJoinError(tournament.error || "Failed to join");
    }
  };

  const handleLeaveRoom = () => {
    tournament.leaveRoom();
  };

  const handleTitleTap = () => {
    const newCount = titleTapCount + 1;
    setTitleTapCount(newCount);
    if (newCount >= 5) {
      setTitleTapCount(0);
      // If not connected, open director portal to create tournament
      // If connected as director, open portal directly
      // If connected but not director, ask for PIN
      if (!tournament.isConnected || tournament.isDirector) {
        setShowDirectorPortal(true);
      } else {
        setShowPinPrompt(true);
      }
    }
    setTimeout(() => setTitleTapCount(0), 2000);
  };

  const handleVerifyPin = async () => {
    const valid = await tournament.verifyDirectorPin(directorPinInput);
    if (valid) {
      setShowPinPrompt(false);
      setDirectorPinInput("");
      setShowDirectorPortal(true);
    } else {
      setJoinError("Invalid PIN");
    }
  };

  if (showDirectorPortal) {
    return <DirectorPortal onClose={() => setShowDirectorPortal(false)} />;
  }

  return (
    <div className="flex flex-col min-h-screen pb-16">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 
            className="text-2xl font-bold cursor-default select-none" 
            onClick={handleTitleTap}
            data-testid="text-settings-title"
          >
            Settings
          </h2>
        </div>

        <div className="space-y-4">
          {/* Tournament/Room Code Section */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Tournament Mode
            </h3>
            
            {tournament.isConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{tournament.tournamentInfo?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Room: {tournament.roomCode}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLeaveRoom}
                    data-testid="button-leave-room"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Leave
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{tournament.myPlayers.length} player(s) assigned to this device</span>
                </div>
                
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setShowPlayerSelection(true)}
                  data-testid="button-manage-players"
                >
                  Manage My Players
                </Button>

                {tournament.isDirector && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowDirectorPortal(true)}
                    data-testid="button-director-portal"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    Director Portal
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter room code"
                    className="flex-1 font-mono text-center tracking-widest"
                    maxLength={6}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleJoinRoom();
                    }}
                    data-testid="input-room-code"
                  />
                  <Button
                    onClick={handleJoinRoom}
                    disabled={tournament.isLoading || !roomCodeInput.trim()}
                    data-testid="button-join-room"
                  >
                    {tournament.isLoading ? "Joining..." : "Join"}
                  </Button>
                </div>
                {joinError && (
                  <p className="text-sm text-destructive">{joinError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter a 6-character room code to join a live tournament
                </p>
              </div>
            )}
          </Card>

          {/* Director PIN Prompt */}
          {showPinPrompt && (
            <Card className="p-4 border-primary">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Director Access
              </h3>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={directorPinInput}
                  onChange={(e) => setDirectorPinInput(e.target.value)}
                  placeholder="Enter director PIN"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerifyPin();
                  }}
                  data-testid="input-director-pin"
                />
                <Button onClick={handleVerifyPin} data-testid="button-verify-pin">
                  Verify
                </Button>
                <Button variant="ghost" onClick={() => setShowPinPrompt(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Add Player Section */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Add Player
            </h3>
            <div className="flex gap-2">
              <Input
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Player name"
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddPlayer();
                }}
                data-testid="input-settings-new-player"
              />
              <Select value={insertPosition} onValueChange={setInsertPosition}>
                <SelectTrigger className="w-28" data-testid="select-settings-position">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">At End</SelectItem>
                  {players.map((player, index) => (
                    <SelectItem key={player.id} value={index.toString()}>
                      Before {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddPlayer}
                data-testid="button-settings-add-player"
              >
                Add
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Current players: {players.length}
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Display</h3>
            
            <div className="flex items-center justify-between py-3 border-b">
              <Label htmlFor="theme-toggle" className="flex-1">
                <div className="font-medium">Dark Theme</div>
                <div className="text-sm text-muted-foreground">Use dark mode for better outdoor visibility</div>
              </Label>
              <Switch
                id="theme-toggle"
                checked={settings.theme === "dark"}
                onCheckedChange={(checked) => onUpdateSettings({ theme: checked ? "dark" : "light" })}
                data-testid="switch-theme"
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <Label htmlFor="left-handed-toggle" className="flex-1">
                <div className="font-medium">Left-Handed Mode</div>
                <div className="text-sm text-muted-foreground">Optimized layout for left-handed use</div>
              </Label>
              <Switch
                id="left-handed-toggle"
                checked={settings.leftHandedMode}
                onCheckedChange={(checked) => onUpdateSettings({ leftHandedMode: checked })}
                data-testid="switch-left-handed"
              />
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4">Game</h3>
            
            <div className="flex items-center justify-between py-3">
              <Label htmlFor="autosave-toggle" className="flex-1">
                <div className="font-medium">Auto-Save</div>
                <div className="text-sm text-muted-foreground">Automatically save game progress</div>
              </Label>
              <Switch
                id="autosave-toggle"
                checked={settings.autoSave}
                onCheckedChange={(checked) => onUpdateSettings({ autoSave: checked })}
                data-testid="switch-autosave"
              />
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">About</h3>
            <p className="text-sm text-muted-foreground mb-2">Par for the Course</p>
            <p className="text-xs text-muted-foreground">Version 2.1.0</p>
          </Card>

          <div className="pt-4">
            <Button
              variant="destructive"
              className="w-full h-12"
              onClick={onEndGame}
              data-testid="button-end-game"
            >
              End Game
            </Button>
          </div>
        </div>
      </div>

      {showPlayerSelection && tournament.isConnected && (
        <PlayerSelectionDialog
          onClose={() => setShowPlayerSelection(false)}
        />
      )}
    </div>
  );
}
