import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage.js";
import { api } from "../shared/routes.js";
import { z } from "zod";
import ical from "node-ical";
import { DateTime } from "luxon";
// import OpenAI from "openai";
import { GoogleGenAI, Type, ThinkingLevel} from '@google/genai';

/* const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}); */

const genAI = new GoogleGenAI({apiKey: process.env['GEMINI_API_KEY'],});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.slots.generate.path, async (req, res) => {
    try {
      const input = api.slots.generate.input.parse(req.body);
      console.log("Received slot generation request with input:", req.body);
      const now = DateTime.now().setZone(input.timezone);
      const currentTimeStr = now.toFormat("yyyy-MM-dd'T'HH:mm:ss"); // 2026-03-04T12:08:26
      const dayOfWeek = now.toFormat("cccc"); // Wednesday
      const workingDays = input.workingDays;

      // Log usage asynchronously
      storage.logUsage({
        timezone: input.timezone,
        prompt: input.prompt
      }).catch(console.error);

      // --- PHASE 1: Intent Extraction ---
      let fullText = ""; 
      const intentConfig = {
                        thinkingConfig: {
                          thinkingLevel: ThinkingLevel.MINIMAL,
                        },
                        responseMimeType: 'application/json',
                        responseSchema: {
                          type: Type.OBJECT,
                          required: ["startDate", "endDate"],
                          properties: {
                            startDate: {
                              type: Type.STRING,
                            },
                            endDate: {
                              type: Type.STRING,
                            },
                          },
                        },
                        systemInstruction: [
                            {
                              text: `You are a Date Intent Parser. Your sole purpose is to convert a user's natural language scheduling request into a specific start and end date range.

                              ### Context Provided in User Message:
                              - Current Time: [ISO_TIMESTAMP]
                              - Timezone: [TIMEZONE_STRING]
                              - User's Working Days: [ARRAY_OF_INTEGERS, 1=Mon, 7=Sun]

                              ### Rules:
                              1. "startDate" Determination:
                                - Unless the user explicitly says "including today," the startDate MUST be the very next available working day after the Current Time.
                                - Example: If today is Wednesday (a working day) and the user asks for "next 2 working days," the startDate is Thursday.
                              2. "endDate" Determination:
                                - For requests of "n working days," calculate the endDate by finding the n-th working day strictly AFTER the Current Time.
                                - Example: Current Time is Wednesday (Working Day). Request is "next 5 working days." 
                                  - 1st: Thursday, 2nd: Friday, 3rd: Monday, 4th: Tuesday, 5th: Wednesday. 
                                  - Result: startDate = Thursday's date, endDate = next Wednesday's date.
                              3. Specific Day Logic:
                                - If the user specifies a day (e.g., "Next Tuesday"), the startDate and endDate should both be that specific Tuesday's date.
                                - If the user says "this weekend," the range should cover Saturday and Sunday.
                              4. Constraints & Format:
                                - ONLY count days present in the "User's Working Days" list (1=Mon, 7=Sun).
                                - If a request is vague (e.g., "my slots"), default to a range covering the next 7 calendar days starting from tomorrow.
                                - Use ISO 8601 (YYYY-MM-DD).
                                - Output ONLY valid JSON: {"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}.

                              ### Output Schema:
                              {
                                "startDate": "YYYY-MM-DD",
                                "endDate": "YYYY-MM-DD"
                              }`,
                            }
                        ],
                      };
      
      const intentModel = 'gemini-3.1-flash-lite-preview';
      const intentContents = [{
                                role: 'user',
                                parts: [
                                  {
                                    text: `Inputs:

                                            Current Time: ${currentTimeStr} (${dayOfWeek})
                                            Timezone: ${input.timezone}
                                            User's Working Days: ${workingDays}
                                            User Request: "${input.prompt}"

                                            Task:
                                            Calculate the startDate and endDate based on the rules.`
                                  }
                                ]
                              }];                

      const intentResponse = await genAI.models.generateContentStream({model: intentModel, config: intentConfig, contents: intentContents});
      for await (const chunk of intentResponse) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullText += chunkText;
        }
      }
      const intent = JSON.parse(fullText);
      console.log("Extracted intent:", intent);
      
      // Phase 2: Free Slot Calculation 

      const windowStartLimit = intent?.startDate 
        ? DateTime.fromISO(intent.startDate, { zone: input.timezone }).startOf('day')
        : now.startOf('day');
        
      const windowEndLimit = intent?.endDate
        ? DateTime.fromISO(intent.endDate, { zone: input.timezone }).endOf('day')
        : now.plus({ days: 14 }).endOf('day');

      // Calculate the difference in days for the loop
      const diffInDays = Math.ceil(windowEndLimit.diff(windowStartLimit, 'days').days) + 1;
      
      let freeWindows: { start: DateTime, end: DateTime }[] = [];
      
      for (let i = 0; i < diffInDays; i++) {
        const currentDay = windowStartLimit.plus({ days: i });
        
        // Apply workingDays filter
        if (input.workingDays.includes(currentDay.weekday)) {
          const windowStart = currentDay.set({ hour: input.workingHours.start, minute: 0, second: 0, millisecond: 0 });
          const windowEnd = currentDay.set({ hour: input.workingHours.end, minute: 0, second: 0, millisecond: 0 });
          
          // Only add windows that are in the future and within the requested range
          if (windowEnd > now && windowEnd <= windowEndLimit) {
            freeWindows.push({
              start: windowStart < now ? now : windowStart,
              end: windowEnd
            });
          }
        }
      }

      // Fetch ICS
      const response = await fetch(input.icsLink);
      if (!response.ok) {
        return res.status(400).json({ message: "Failed to fetch the ICS link." });
      }
      
      const icsData = await response.text();
      const events = ical.sync.parseICS(icsData);
            
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
      
      // --- PHASE 3: Formatting the Output ---
      let slots = "";
      const responseConfig = {
                                  temperature: 0.2,
                                  thinkingConfig: {
                                    thinkingLevel: ThinkingLevel.MINIMAL,
                                  },
                                  systemInstruction: [
                                      {
                                        text: `You are an expert Calendar Scheduler. Your task is to take a raw list of "Available Gaps" and format them into a clean, professional bulleted list based on the "User's Formatting Request."

                                                ### Constraints:
                                                1. Accuracy: Only use the dates and times provided in the "Available Gaps" section. Do not invent slots.
                                                2. Formatting Style: Unless the user specifies otherwise, use the following default format:
                                                  * [Day of week] ([Date]): [Start Time] - [End Time]
                                                  * Example: Monday (2 Mar): 11:30 AM - 1:30 PM, 3:00 PM - 5:00 PM
                                                3. Grouping: Group all slots for the same day under a single bullet point.
                                                4. Conciseness: Do not include introductory filler like "Here are your slots." Output ONLY the list.
                                                5. Empty State: If the "Available Gaps" list is empty, respond with: "No free slots found for the requested period."`,
                                                        }
                                                    ],
                              };
      const responseModel = 'gemini-3.1-flash-lite-preview';
      const responseContents = [{
                                  role: 'user',
                                  parts: [
                                    {
                                      text: `User Request: ${input.prompt}\n\nAvailable Gaps:\n${rawGaps}`,
                                    },
                                  ],
                                },];
      const aiResponse = await genAI.models.generateContentStream({model: responseModel, config: responseConfig, contents: responseContents});                        
      for await (const chunk of aiResponse) {
        const chunkText = chunk.text;
        if (chunkText) {
          slots += chunkText;
        }
      }
      if (!slots.trim()) {
                            slots = "No free slots found based on criteria";
                          }
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
