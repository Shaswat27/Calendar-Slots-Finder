import { useMemo } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CalendarDays, Globe, Settings2 } from "lucide-react";

export type SlotSettings = {
  workingDays: number[];
  workingHours: { start: number; end: number };
  timezone: string;
};

interface SettingsSidebarProps {
  settings: SlotSettings;
  onChange: (settings: SlotSettings) => void;
}

const DAYS = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Tu" },
  { value: 3, label: "We" },
  { value: 4, label: "Th" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 7, label: "Su" },
];

export function SettingsSidebar({ settings, onChange }: SettingsSidebarProps) {
  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf("timeZone");
    } catch {
      return ["UTC"];
    }
  }, []);

  const hours = Array.from({ length: 25 }, (_, i) => i);

  const updateWorkingDays = (values: string[]) => {
    // Ensure at least one day is selected to prevent validation errors
    if (values.length === 0) return;
    onChange({ ...settings, workingDays: values.map(Number) });
  };

  const updateStartHour = (val: string) => {
    const start = Number(val);
    const end = Math.max(start + 1, settings.workingHours.end);
    onChange({ ...settings, workingHours: { start, end } });
  };

  const updateEndHour = (val: string) => {
    const end = Number(val);
    const start = Math.min(end - 1, settings.workingHours.start);
    onChange({ ...settings, workingHours: { start, end } });
  };

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar-background/50 backdrop-blur-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3 px-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Settings2 className="w-5 h-5" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">Preferences</span>
        </div>
      </SidebarHeader>
      
      <SidebarContent className="px-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
            <CalendarDays className="w-3.5 h-3.5" />
            Working Days
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <ToggleGroup
              type="multiple"
              value={settings.workingDays.map(String)}
              onValueChange={updateWorkingDays}
              className="justify-between bg-black/20 p-1.5 rounded-xl border border-border/50"
            >
              {DAYS.map((day) => (
                <ToggleGroupItem
                  key={day.value}
                  value={String(day.value)}
                  className="w-8 h-8 rounded-md text-xs font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground transition-all duration-200"
                >
                  {day.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="my-6 border-t border-border/50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
            <Clock className="w-3.5 h-3.5" />
            Working Hours
          </SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start Time</Label>
                <Select value={String(settings.workingHours.start)} onValueChange={updateStartHour}>
                  <SelectTrigger className="bg-black/20 border-border/50 rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.slice(0, 24).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h.toString().padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">End Time</Label>
                <Select value={String(settings.workingHours.end)} onValueChange={updateEndHour}>
                  <SelectTrigger className="bg-black/20 border-border/50 rounded-xl h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hours.slice(1).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h.toString().padStart(2, "0")}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="my-6 border-t border-border/50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
            <Globe className="w-3.5 h-3.5" />
            Timezone
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <Select value={settings.timezone} onValueChange={(tz) => onChange({ ...settings, timezone: tz })}>
              <SelectTrigger className="w-full bg-black/20 border-border/50 rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
