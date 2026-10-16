import { Button } from "@/components/ui/button";
import { Home, Trophy, Settings as SettingsIcon, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavProps {
  activeTab: "game" | "summary" | "settings" | "save";
  isGameEnded: boolean;
  onHome: () => void;
  onTabChange: (tab: "game" | "summary" | "settings" | "save") => void;
}

export function BottomNav({ activeTab, isGameEnded, onHome, onTabChange }: BottomNavProps) {
  const tabs = [
    { id: "game" as const, icon: Home, label: isGameEnded ? "Home" : "Game" },
    { id: "summary" as const, icon: Trophy, label: "Summary" },
    { id: "save" as const, icon: Save, label: "Save" },
    { id: "settings" as const, icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-stretch border-t-2 border-[hsl(38_50%_34%)] bg-gradient-to-b from-[#12261b] to-[#050c08] pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_18px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,220,160,0.2)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = !isGameEnded ? activeTab === tab.id : tab.id === "game" && activeTab === "game";

        return (
          <Button
            key={tab.id}
            variant="ghost"
            className={cn(
              "relative h-full flex-1 flex-col items-center justify-center gap-1 rounded-none",
              isActive && "bg-amber-400/10"
            )}
            onClick={() => {
              if (tab.id === "game" && isGameEnded) {
                onHome();
                return;
              }
              onTabChange(tab.id);
            }}
            data-testid={`nav-${tab.id}`}
          >
            {isActive && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-amber-400 shadow-[0_0_10px_#fbbf24]" aria-hidden />}
            <Icon className={cn("h-5 w-5 text-white/70", isActive && "text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]")} />
            <span className={cn("text-[11px] uppercase tracking-wider text-white/70", isActive && "font-extrabold text-amber-300")}>
              {tab.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
