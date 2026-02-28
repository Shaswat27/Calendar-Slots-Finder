import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Link2, Sparkles, Loader2, Copy, Check, CalendarCheck } from "lucide-react";
import { useGenerateSlots } from "@/hooks/use-slots";
import { useToast } from "@/hooks/use-toast";
import type { SlotSettings } from "./settings-sidebar";

interface SlotFormProps {
  settings: SlotSettings;
}

export function SlotForm({ settings }: SlotFormProps) {
  const { toast } = useToast();
  const generateSlots = useGenerateSlots();
  
  const [icsLink, setIcsLink] = useState("");
  const [prompt, setPrompt] = useState("Give me my free slots for the next 5 working days");
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    if (!icsLink) {
      toast({
        title: "Calendar Link Required",
        description: "Please enter a valid ICS public calendar link.",
        variant: "destructive"
      });
      return;
    }

    if (!icsLink.startsWith("http")) {
      toast({
        title: "Invalid URL",
        description: "The calendar link must start with http:// or https://",
        variant: "destructive"
      });
      return;
    }

    generateSlots.mutate({
      icsLink,
      prompt,
      ...settings,
    });
  };

  const handleCopy = () => {
    if (!generateSlots.data?.slots) return;
    
    navigator.clipboard.writeText(generateSlots.data.slots);
    setCopied(true);
    toast({
      description: "Copied to clipboard!",
      duration: 2000,
    });
    
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-12">
      <header className="space-y-4 pt-12 md:pt-20">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 text-primary text-sm font-medium shimmer-border">
          <CalendarCheck className="w-4 h-4" />
          AI Calendar Assistant
        </div>
        <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight text-foreground">
          Find your free time. <span className="text-muted-foreground">Fast.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl">
          Connect your calendar and let AI find the perfect meeting slots based on your preferences.
        </p>
      </header>

      <div className="space-y-8">
        <div className="space-y-3 group">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            Public ICS Calendar Link
          </Label>
          <Input
            value={icsLink}
            onChange={(e) => setIcsLink(e.target.value)}
            placeholder="https://outlook.office365.com/.../calendar.ics"
            className="h-14 bg-black/40 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl text-base px-5 shadow-inner transition-all"
          />
        </div>

        <div className="space-y-3 group">
          <Label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            What do you need?
          </Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Give me my free slots for the next 5 working days..."
            className="min-h-[120px] resize-none bg-black/40 border-border/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 rounded-xl text-base p-5 shadow-inner transition-all leading-relaxed"
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generateSlots.isPending}
          className="w-full h-14 rounded-xl text-base font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
        >
          {generateSlots.isPending ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Analyzing Calendar...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Generate Free Slots
              <Sparkles className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>

      <AnimatePresence>
        {generateSlots.data?.slots && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="pt-4"
          >
            <div className="relative group rounded-2xl border border-border/50 bg-black/40 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-white/[0.02]">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Generated Slots</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 text-muted-foreground hover:text-foreground"
                >
                  {copied ? <Check className="w-4 h-4 mr-2 text-green-500" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? "Copied" : "Copy to Clipboard"}
                </Button>
              </div>
              <div className="p-6 overflow-x-auto">
                <pre className="font-sans text-sm md:text-base leading-relaxed text-foreground/90 whitespace-pre-wrap">
                  {generateSlots.data.slots}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Spacer to allow scrolling past content */}
      <div className="h-12" />
    </div>
  );
}
