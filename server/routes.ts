import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import ical from "node-ical";
import { DateTime } from "luxon";
import OpenAI from "openai";

// Using OpenAI via Replit AI Integrations
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.slots.generate.path, async (req, res) => {
    try {
      const input = api.slots.generate.input.parse(req.body);
      
      // Log usage asynchronously
      storage.logUsage({
        timezone: input.timezone,
        prompt: input.prompt
      }).catch(console.error);

      // Fetch ICS
      const response = await fetch(input.icsLink);
      if (!response.ok) {
        return res.status(400).json({ message: "Failed to fetch the ICS link." });
      }
      
      const icsData = await response.text();
      const events = ical.sync.parseICS(icsData);
      
      // Lookahead days: assuming the user might want slots for a specific period,
      // we generate 30 days of gaps and let the LLM filter according to their prompt.
      const now = DateTime.now().setZone(input.timezone);
      const lookaheadDays = 30;
      
      let freeWindows: { start: DateTime, end: DateTime }[] = [];
      
      for (let i = 0; i < lookaheadDays; i++) {
        const currentDay = now.plus({ days: i });
        // Luxon weekday: 1 = Monday, 7 = Sunday
        if (input.workingDays.includes(currentDay.weekday)) {
          const windowStart = currentDay.set({ hour: input.workingHours.start, minute: 0, second: 0, millisecond: 0 });
          const windowEnd = currentDay.set({ hour: input.workingHours.end, minute: 0, second: 0, millisecond: 0 });
          
          if (windowEnd > now) {
            freeWindows.push({
              start: windowStart < now ? now : windowStart,
              end: windowEnd
            });
          }
        }
      }
      
      // Filter out busy events
      for (const event of Object.values(events)) {
        // Explicitly check that event exists and is a VEVENT
        if (!event || event.type !== 'VEVENT') continue;

        // Cast to 'any' to bypass library type limitations safely
        const vevent = event as any;

        // Verify start and end dates exist
        if (!vevent.start || !vevent.end) continue;
        
        const eventStart = DateTime.fromJSDate(vevent.start as Date).setZone(input.timezone);
        const eventEnd = DateTime.fromJSDate(vevent.end as Date).setZone(input.timezone);
        
        let newWindows: { start: DateTime, end: DateTime }[] = [];
        
        for (const window of freeWindows) {
          if (eventStart >= window.end || eventEnd <= window.start) {
            newWindows.push(window); // No overlap
          } else {
            // Overlap, split window
            if (window.start < eventStart) {
              newWindows.push({ start: window.start, end: eventStart });
            }
            if (window.end > eventEnd) {
              newWindows.push({ start: eventEnd, end: window.end });
            }
          }
        }
        freeWindows = newWindows;
      }
      
      // Format the raw gaps
      const rawGaps = freeWindows.map(w => 
        `${w.start.toFormat('EEEE (d MMM)')}: ${w.start.toFormat('h:mm a')} - ${w.end.toFormat('h:mm a')}`
      ).join('\n');
      
      const systemInstructions = `You are an expert assistant for a calendar free-slot generator tool.
Your job is to read raw calendar gaps and filter/format them according to the user's natural language instructions.
Default instructions from app: "Format these free slots into a bulleted list exactly like this: 'Monday (2 Mar): 11:30-1:30 p.m., 3-5 p.m.' Each day should be its own bullet. Use 12-hour AM/PM format. Only output the list, no conversational filler."

Important:
- Read the "User Request" carefully. If the user says "next 5 working days", only output 5 working days from the provided gaps.
- Do NOT hallucinate slots. Only use the provided "Available Gaps".
- If no gaps fit the user's criteria, respond simply stating that.`;

      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini", // fallback model if needed, but Replit supports gpt-5.2 and gpt-4o-mini via AI integrations.
        messages: [
          { role: "system", content: systemInstructions },
          { role: "user", content: `User Request: ${input.prompt}\n\nAvailable Gaps:\n${rawGaps}` }
        ],
        temperature: 0,
      });

      const slots = aiResponse.choices[0]?.message?.content?.trim() || "No free slots found based on criteria.";

      res.status(200).json({ slots });
    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path?.join('.'),
        });
      }
      res.status(500).json({ message: "An internal server error occurred." });
    }
  });

  return httpServer;
}
