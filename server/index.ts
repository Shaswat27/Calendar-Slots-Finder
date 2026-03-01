import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { createServer } from "http";
import path from "path";

const app = express();
const httpServer = createServer(app);

console.log("!!! Server script loaded by Vercel !!!");

// Types for raw body (useful for webhooks if you add them later)
declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// 1. GLOBAL MIDDLEWARE
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// Helper for formatted logging
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// 2. REQUEST LOGGING MIDDLEWARE
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });
  next();
});

// 3. CORE INITIALIZATION
// We separate the route registration from the server listening logic
// to ensure Vercel can see the routes immediately upon import.
const setupApp = async () => {
  // Register API routes immediately
  await registerRoutes(httpServer, app);

  // Global Error Handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_REGION;
  const isDev = process.env.NODE_ENV === "development" && !isVercel;

  if (isDev) {
    // Standard local development (npm run server)
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "0.0.0.0" }, () => {
      log(`Serving on port ${port} (Local Dev Mode)`);
    });
  } else {
    // Production or Vercel environment
    // const publicPath = path.join(process.cwd(), "dist", "public");
    // app.use(express.static(publicPath));

    // ONLY catch-all for non-API routes to allow the SPA to handle routing
    //app.get(/^(?!\/api).+/, (req, res) => {
    //  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    //    if (err) {
          // If the file doesn't exist (common in local dev), just move to the next handler
    //      res.status(404).send("Frontend build not found. If on local, ensure you're using the Vercel-provided port.");
    //    }
    //  });
    //  });
    log("Vercel runtime detected, skipping local listener.");
  }
};

// Fire and forget the setup - the 'app' export remains available for Vercel
setupApp().catch((err) => {
  console.error("Failed to initialize server:", err);
});

/**
 * CRITICAL: Vercel requires the Express instance as the default export.
 */
export default app;