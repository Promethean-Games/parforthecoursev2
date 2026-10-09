import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Shield, Home } from "lucide-react";
import { useTournament } from "@/contexts/TournamentContext";
import { unlockAllTestEntitlements } from "@/lib/entitlements";
import { PlayerSelectionDialog } from "./PlayerSelectionDialog";
import { DirectorPortal } from "./DirectorPortal";
import type { Settings, Player } from "@shared/schema";

interface SettingsPanelProps {
  settings: Settings;
  players: Player[];
  onUpdateSettings: (settings: Partial<Settings>) => void;
  onAddPlayer: (name: string, position?: number) => void;
  onEndGame: () => void;
  onHome: () => void;
}

export function SettingsPanel({ settings, players, onUpdateSettings, onAddPlayer, onEndGame, onHome }: SettingsPanelProps) {
  const [newPlayerName, setNewPlayerName] = useState("");
  const [insertPosition, setInsertPosition] = useState<string>("end");
  const [testCodeInput, setTestCodeInput] = useState("");
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [titleTapCount, setTitleTapCount] = useState(0);
  const [testCodeStatus, setTestCodeStatus] = useState<string | null>(null);
  const [directorError, setDirectorError] = useState<string | null>(null);
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

  const handleUnlockTestAccess = async () => {
    if (!testCodeInput.trim()) return;
    setTestCodeStatus(null);

    const success = await unlockAllTestEntitlements(testCodeInput);
    if (success) {
      setTestCodeInput("");
      setTestCodeStatus("Test access enabled. All entitlements unlocked.");
    } else {
      setTestCodeStatus("Invalid test code. Please check the shared tester access code.");
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
    setDirectorError(null);
    const valid = await tournament.verifyDirectorPin(directorPinInput);
    if (valid) {
      setShowPinPrompt(false);
      setDirectorPinInput("");
      setShowDirectorPortal(true);
    } else {
      setDirectorError("Invalid PIN");
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
          {/* Director PIN Prompt */}
          {showPinPrompt && (
            <Card className="p-4 border-primary">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Director Access
              </h3>
              <div className="space-y-3">
                <Input
                  type="text"
                  value={directorPinInput}
                  onChange={(e) => setDirectorPinInput(e.target.value)}
                  placeholder="Enter director PIN"
                  className="w-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVerifyPin();
                  }}
                  data-testid="input-director-pin"
                  autoFocus
                />
                {directorError && (
                  <p className="text-sm text-destructive">{directorError}</p>
                )}
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleVerifyPin} data-testid="button-verify-pin">
                    Verify
                  </Button>
                  <Button className="flex-1" variant="ghost" onClick={() => setShowPinPrompt(false)}>
                    Cancel
                  </Button>
                </div>
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

          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Test Code
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={testCodeInput}
                  onChange={(e) => setTestCodeInput(e.target.value.toUpperCase())}
                  placeholder="Enter test code"
                  className="flex-1 font-mono text-center tracking-widest"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUnlockTestAccess();
                  }}
                  data-testid="input-test-code"
                />
                <Button
                  onClick={handleUnlockTestAccess}
                  className="bg-green-600 hover:bg-green-500"
                  disabled={!testCodeInput.trim()}
                  data-testid="button-unlock-test-access"
                >
                  Unlock
                </Button>
              </div>
              {testCodeStatus && (
                <p className="text-sm text-emerald-500">{testCodeStatus}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter the tester code to unlock all digital entitlements for QA and Play Store testing.
              </p>
            </div>
          </Card>

          <div className="pt-4 space-y-3">
            <button
              onClick={() => window.open("https://forms.gle/dss9Ksbenx3WTzh29", "_blank")}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors py-2"
              data-testid="button-submit-feedback-settings"
            >
              Submit Feedback
            </button>
            <Button
              variant="outline"
              className="w-full h-12"
              onClick={onHome}
              data-testid="button-home-settings"
            >
              <Home className="w-4 h-4 mr-2" />
              Home
            </Button>
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
