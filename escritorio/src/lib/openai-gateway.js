/**
 * OpenAI Gateway — drop-in replacement for OpenClawGateway
 * Implements the same interface: chatSend, agentsList, agentsCreate, etc.
 * Uses OpenAI Chat Completions API with streaming.
 */

"use strict";

const { randomUUID } = require("crypto");

// In-memory conversation history: sessionKey -> messages[]
const sessionHistory = new Map();

// In-memory agent store: agentId -> { name, systemPrompt, files, emoji }
const agentStore = new Map();

// Token usage tracking: emitted so socket-handlers can log to DB
const tokenUsageCallbacks = [];

function onTokenUsage(cb) {
  tokenUsageCallbacks.push(cb);
}

function emitTokenUsage(data) {
  for (const cb of tokenUsageCallbacks) {
    try { cb(data); } catch {}
  }
}

class OpenAIGateway {
  constructor() {
    this._apiKey = null;
    this._model = "gpt-4o";
    this._status = "disconnected";
  }

  isConnected() {
    return this._status === "connected";
  }

  /**
   * "Connect" for OpenAI just stores the API key.
   * baseUrl format: "openai://gpt-4o" or just "openai"
   */
  async connect(baseUrl, apiKey) {
    this._apiKey = apiKey;
    // extract model from baseUrl if provided: "openai://gpt-4o"
    const modelMatch = baseUrl && baseUrl.startsWith("openai://")
      ? baseUrl.replace("openai://", "").trim()
      : null;
    if (modelMatch) this._model = modelMatch;
    this._status = "connected";
    return this;
  }

  disconnect() {
    this._status = "disconnected";
  }

  /**
   * Send a chat message and stream the response.
   * Maintains per-session conversation history.
   */
  async chatSend(agentId, sessionKey, message, onDelta, _attachments) {
    if (!this._apiKey) throw new Error("OpenAI gateway not connected — no API key");

    const agent = agentStore.get(agentId) || { name: agentId, systemPrompt: "", files: {} };
    const systemPrompt = agent.systemPrompt
      || agent.files?.["IDENTITY.md"]
      || `You are ${agent.name || agentId}, a helpful AI assistant.`;

    // Build conversation history
    const history = sessionHistory.get(sessionKey) || [];
    history.push({ role: "user", content: message });

    const messages = [
      { role: "system", content: systemPrompt },
      ...history,
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this._apiKey}`,
      },
      body: JSON.stringify({
        model: this._model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err}`);
    }

    let fullText = "";
    let usage = null;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onDelta(delta);
          }
          if (parsed.usage) usage = parsed.usage;
        } catch {}
      }
    }

    // Save assistant response to history
    history.push({ role: "assistant", content: fullText });
    sessionHistory.set(sessionKey, history.slice(-40)); // keep last 40 messages

    // Emit token usage for reporting
    if (usage) {
      emitTokenUsage({
        agentId,
        sessionKey,
        model: this._model,
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0,
        timestamp: new Date().toISOString(),
      });
    }

    return fullText;
  }

  chatAbort(_agentId, sessionKey) {
    // OpenAI streaming doesn't support mid-stream abort easily — clear history
    sessionHistory.delete(sessionKey);
  }

  // ── Agents ──────────────────────────────────────────────────

  async agentsList() {
    return Array.from(agentStore.entries()).map(([id, a]) => ({
      id,
      name: a.name,
      emoji: a.emoji || "🤖",
    }));
  }

  async agentsCreate(name, _workspace, emoji) {
    const agentId = randomUUID();
    agentStore.set(agentId, { name, emoji: emoji || "🤖", systemPrompt: "", files: {} });
    return { agentId };
  }

  async agentsDelete(agentId) {
    agentStore.delete(agentId);
    return { ok: true };
  }

  async agentsFileGet(agentId, name) {
    const agent = agentStore.get(agentId);
    return { content: agent?.files?.[name] || "" };
  }

  async agentsFileSet(agentId, name, content) {
    const agent = agentStore.get(agentId) || { name: agentId, emoji: "🤖", systemPrompt: "", files: {} };
    agent.files = agent.files || {};
    agent.files[name] = content;
    // IDENTITY.md becomes the system prompt
    if (name === "IDENTITY.md" || name === "SOUL.md") {
      const identity = agent.files["IDENTITY.md"] || "";
      const soul = agent.files["SOUL.md"] || "";
      agent.systemPrompt = [identity, soul].filter(Boolean).join("\n\n---\n\n");
    }
    agentStore.set(agentId, agent);
    return { ok: true };
  }

  async agentsFilesList(agentId) {
    const agent = agentStore.get(agentId);
    return Object.keys(agent?.files || {});
  }
}

/**
 * Detect if a gateway baseUrl is an OpenAI gateway.
 * Formats: "openai", "openai://gpt-4o", "openai://gpt-4o-mini"
 */
function isOpenAIGateway(baseUrl) {
  return typeof baseUrl === "string" && baseUrl.startsWith("openai");
}

module.exports = { OpenAIGateway, isOpenAIGateway, onTokenUsage };
