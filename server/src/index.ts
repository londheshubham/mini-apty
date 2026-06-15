import express from "express";
import { AppDataSource } from "./config/datasource";
import authRoutes from "./routes/auth.routes";
import walkthroughRoutes from "./routes/walkthrough.routes";

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());

const PORT = process.env.PORT;

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
app.use("/auth", authRoutes);
app.use("/walkthroughs", walkthroughRoutes);

AppDataSource.initialize()
  .then(() => {
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed", err);
  });

process.on("SIGINT", async () => {
  await AppDataSource.destroy();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await AppDataSource.destroy();
  process.exit(0);
});
