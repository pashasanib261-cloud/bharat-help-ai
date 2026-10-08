require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const OpenAI = require("openai");
const path = require("path");

const app = express();

const client = new OpenAI({
  apiKey: process.env.HF_TOKEN,
  baseURL: "https://router.huggingface.co/v1"
});

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
}));

const sessions = new Map();

const SYSTEM = `
You are Bharat Help AI, a helpful Indian public-service assistant.
Reply in the user's language when possible, especially Hindi.
Be concise, respectful and practical.
Do not invent current government, legal, medical or emergency facts.
Recommend official verification for high-impact topics.
Never claim to be a government authority.
Protect personal information and never expose private contact details.
`;

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Bharat Help AI" });
});

app.use(express.static(path.join(__dirname)));

app.post("/api/chat", async (req, res) => {
  try {
    const message =
      typeof req.body?.message === "string"
        ? req.body.message.trim()
        : "";

    const sessionId =
      typeof req.body?.sessionId === "string"
        ? req.body.sessionId.trim()
        : "";

    if (!message || !sessionId) {
      return res.status(400).json({
        error: "message_and_sessionId_required"
      });
    }

    let history = sessions.get(sessionId) || [];

    history.push({
      role: "user",
      content: message
    });

    history = history.slice(-12);

    const completion = await client.chat.completions.create({
      model: process.env.HF_MODEL || "openai/gpt-oss-120b:fastest",
      messages: [
        { role: "system", content: SYSTEM },
        ...history
      ],
      max_tokens: 700
    });

    const answer =
      completion.choices?.[0]?.message?.content ||
      "माफ़ कीजिए, अभी जवाब नहीं मिल पाया।";

    history.push({
      role: "assistant",
      content: answer
    });

    sessions.set(sessionId, history.slice(-12));

    res.json({ answer });

  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: "ai_request_failed"
    });
  }
});

app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log("Bharat Help AI running");
});
