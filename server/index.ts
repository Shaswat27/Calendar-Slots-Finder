import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

/**
 * Initialization Logic
 * * We use a guard to check if we are running in a Vercel environment (Local or Cloud).
 * If on Vercel, we only register routes. Vercel's runtime handles the server start.
 */
const init = async () => {
  // 1. Register API and Socket routes
  await registerRoutes(httpServer, app);

  // 2. Global Error Handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  // Detect if running under Vercel CLI (Local Dev) or Vercel Cloud (Production)
  const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION;

  if (process.env.NODE_ENV === "production") {
    // Standard production (non-serverless) or Vercel production static handling
    serveStatic(app);
  } else if (!isVercel) {
    /**
     * LOCAL DEVELOPMENT (Non-Vercel)
     * e.g., 'npm run dev'
     */
    const { setupVite } = await import("./vite.js"); 
    await setupVite(httpServer, app);
    
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "127.0.0.1" }, () => {
      log(`serving on port ${port}`);
    });
  } else {
    /**
     * VERCEL DEV ENVIRONMENT
     * We don't call .listen() here. Vercel wraps the 'app' export 
     * and manages the port itself.
     */
    log("Vercel environment detected; skipping manual listener.");
  }
};

// Start the async initialization
init();

/**
 * CRITICAL: Vercel requires the Express instance as the default export.
 */
export default app;