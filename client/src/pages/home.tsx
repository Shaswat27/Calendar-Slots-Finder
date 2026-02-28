import { useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SettingsSidebar, type SlotSettings } from "@/components/settings-sidebar";
import { SlotForm } from "@/components/slot-form";

function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export default function Home() {
  const [settings, setSettings] = useState<SlotSettings>({
    workingDays: [1, 2, 3, 4, 5],
    workingHours: { start: 9, end: 18 },
    timezone: getDefaultTimezone(),
  });

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden relative">
        <SettingsSidebar settings={settings} onChange={setSettings} />
        
        <main className="flex-1 flex flex-col h-full bg-grid-pattern relative">
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/95 to-background pointer-events-none" />
          
          <div className="absolute top-4 left-4 z-50 md:hidden">
            <SidebarTrigger className="bg-background/50 backdrop-blur-md border border-border shadow-sm rounded-lg p-2" />
          </div>

          <div className="relative z-10 flex-1 overflow-y-auto w-full">
            <div className="px-6 pb-20 w-full">
              <SlotForm settings={settings} />
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
