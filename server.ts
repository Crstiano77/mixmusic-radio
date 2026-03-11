import express from "express";
import { createServer as createViteServer } from "vite";
import webpush from "web-push";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(bodyParser.json());

  // VAPID keys should be generated and set in environment variables
  const publicVapidKey = process.env.VAPID_PUBLIC_KEY || "";
  const privateVapidKey = process.env.VAPID_PRIVATE_KEY || "";
  const vapidEmail = process.env.VAPID_EMAIL || "mailto:admin@example.com";

  if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(vapidEmail, publicVapidKey, privateVapidKey);
  }

  // In-memory storage for subscriptions (In production, use a database)
  const subscriptions: any[] = [];

  // API Routes
  app.get("/api/vapid-public-key", (req, res) => {
    res.json({ publicKey: publicVapidKey });
  });

  app.post("/api/subscribe", (req, res) => {
    const subscription = req.body;
    
    // Check if subscription already exists
    const exists = subscriptions.find(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      subscriptions.push(subscription);
    }
    
    res.status(201).json({ message: "Subscription added successfully." });
  });

  app.post("/api/send-notification", (req, res) => {
    const { title, body, icon, url } = req.body;
    const payload = JSON.stringify({ title, body, icon, url });

    const notifications = subscriptions.map(subscription => {
      return webpush.sendNotification(subscription, payload).catch(err => {
        console.error("Error sending notification:", err);
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Remove expired subscriptions
          const index = subscriptions.indexOf(subscription);
          if (index > -1) subscriptions.splice(index, 1);
        }
      });
    });

    Promise.all(notifications)
      .then(() => res.status(200).json({ message: "Notifications sent." }))
      .catch(err => res.status(500).json({ error: err.message }));
  });

  app.get("/api/deezer-search", async (req, res) => {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
      const response = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q as string)}`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Deezer proxy error:", error);
      res.status(500).json({ error: "Failed to fetch from Deezer" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    if (!publicVapidKey || !privateVapidKey) {
      console.warn("WARNING: VAPID keys are missing. Push notifications will not work until VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set in environment variables.");
    }
  });
}

startServer();
