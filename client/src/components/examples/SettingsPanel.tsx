import { useState } from "react";
import { SettingsPanel } from "../SettingsPanel";
import type { Settings } from "@shared/schema";

export default function SettingsPanelExample() {
  const [settings, setSettings] = useState<Settings>({
    theme: "dark",
    leftHandedMode: false,
    autoSave: true,
  });

  return (
    <SettingsPanel
      settings={settings}
      players={[]}
      onUpdateSettings={(updates) => setSettings({ ...settings, ...updates })}
      onAddPlayer={() => console.log("Add player")}
      onEndGame={() => console.log("End game")}
    />
  );
}
