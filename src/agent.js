import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE = fs.readFileSync(path.join(here, "..", "knowledge", "sindicato.md"), "utf8");

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
const EFFORT = process.env.CLAUDE_EFFORT || "low";
// Una conversación se reinicia tras este tiempo sin mensajes o al llegar al
// límite de turnos. Nunca recortamos el historial a medias: se reinicia completo.
const IDLE_MS = 30 * 60 * 1000;
const MAX_TURNS = 20;

const client = new Anthropic();

const SYSTEM = `Eres el asistente de WhatsApp del Sindicato de Taxistas de Playa del Carmen. Atiendes a usuarios (turistas, residentes y agremiados) que escriben con solicitudes, dudas, quejas o reportes.

Cómo contestar:
- Responde en el idioma en que te escriban (normalmente español o inglés).
- Mensajes cortos y claros, como en un chat de WhatsApp. Sin tablas ni encabezados; usa saltos de línea y, si ayuda, listas breves.
- Basa tus respuestas solo en la INFORMACIÓN DEL SINDICATO de abajo. Si algo no está ahí (una tarifa, un horario, un teléfono), no lo inventes: di que no tienes ese dato y ofrece el contacto de atención humana.
- Para quejas, objetos olvidados o reportes de un servicio, pide los datos útiles (fecha y hora, origen y destino, número económico o placas del taxi, descripción) y explica cómo se canalizan según la información de abajo.
- En una emergencia o si alguien está en peligro, indica de inmediato que llame al 911.
- Sé amable y profesional. No hables de política del sindicato ni des opiniones sobre conflictos con otras plataformas de transporte.

INFORMACIÓN DEL SINDICATO:
${KNOWLEDGE}`;

const conversations = new Map();

function historyFor(user) {
  const now = Date.now();
  let conv = conversations.get(user);
  if (!conv || now - conv.lastAt > IDLE_MS || conv.turns >= MAX_TURNS) {
    conv = { messages: [], turns: 0, lastAt: now };
    conversations.set(user, conv);
  }
  conv.lastAt = now;
  return conv;
}

export async function reply({ from, name, type, text }) {
  if (type !== "text") {
    return "Por ahora solo puedo leer mensajes de texto. ✍️ ¿Me escribes tu duda?";
  }

  const conv = historyFor(from);
  const content = name ? `[${name}]: ${text}` : text;
  const messages = [...conv.messages, { role: "user", content }];

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      cache_control: { type: "ephemeral" },
      system: SYSTEM,
      messages,
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("Claude: límite de uso", err.message);
    } else if (err instanceof Anthropic.APIError) {
      console.error(`Claude: error ${err.status}`, err.message);
    } else {
      console.error("Claude: error de conexión", err);
    }
    return "Perdón, tuve un problema para contestar. Inténtalo de nuevo en unos minutos.";
  }

  if (response.stop_reason === "refusal") {
    return "Perdón, no puedo ayudarte con eso. Si es sobre un servicio de taxi, cuéntame qué pasó.";
  }

  // Guardamos la respuesta completa (incluidos los bloques de razonamiento)
  // para que el historial se mantenga tal cual entre turnos.
  conv.messages = [...messages, { role: "assistant", content: response.content }];
  conv.turns += 1;

  const answer = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return answer || null;
}
