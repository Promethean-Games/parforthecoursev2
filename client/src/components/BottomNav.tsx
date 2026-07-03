import { Button } from "@/components/ui/button";
import { Home, Trophy, Settings as SettingsIcon, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: "game" | "summary" | "settings" | "save";
  onTabChange: (tab: "game" | "summary" | "settings" | "save") => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: "game" as const, icon: Home, label: "Game" },
    { id: "summary" as const, icon: Trophy, label: "Summary" },
    { id: "save" as const, icon: Save, label: "Save" },
    { id: "settings" as const, icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t flex items-center z-40">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <Button
            key={tab.id}
            variant="ghost"
            className={cn(
              "flex-1 h-full rounded-none flex flex-col gap-1 items-center justify-center",
              isActive && "bg-primary/10"
            )}
            onClick={() => onTabChange(tab.id)}
            data-testid={`nav-${tab.id}`}
          >
            <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
            <span className={cn("text-xs", isActive && "text-primary font-semibold")}>
              {tab.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
