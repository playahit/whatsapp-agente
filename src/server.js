import http from "node:http";
import crypto from "node:crypto";
import { sendText, markAsRead } from "./whatsapp.js";
import { reply } from "./agent.js";

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const APP_SECRET = process.env.META_APP_SECRET;

// Meta reintenta webhooks; evitamos contestar dos veces el mismo mensaje.
const seen = new Set();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function validSignature(raw, header) {
  if (!APP_SECRET) return true; // sin secreto configurado no se valida (solo para pruebas)
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  const given = header.slice(7);
  return given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function handleMessage(msg, contact) {
  if (seen.has(msg.id)) return;
  seen.add(msg.id);
  if (seen.size > 5000) seen.clear();

  await markAsRead(msg.id).catch(() => {});
  const text = await reply({
    from: msg.from,
    name: contact?.profile?.name,
    type: msg.type,
    text: msg.text?.body ?? "",
  });
  if (text) await sendText(msg.from, text);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/") {
    res.writeHead(200).end("ok");
    return;
  }

  if (url.pathname !== "/webhook") {
    res.writeHead(404).end();
    return;
  }

  // Verificación inicial que hace Meta al registrar el webhook.
  if (req.method === "GET") {
    const ok = url.searchParams.get("hub.mode") === "subscribe" &&
      VERIFY_TOKEN && url.searchParams.get("hub.verify_token") === VERIFY_TOKEN;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get("hub.challenge") : "");
    return;
  }

  if (req.method === "POST") {
    const raw = await readBody(req);
    if (!validSignature(raw, req.headers["x-hub-signature-256"])) {
      res.writeHead(401).end();
      return;
    }
    // Respondemos 200 de inmediato para que Meta no reintente.
    res.writeHead(200).end();

    let body;
    try { body = JSON.parse(raw); } catch { return; }
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        for (const msg of value.messages ?? []) {
          handleMessage(msg, value.contacts?.[0]).catch((err) =>
            console.error("Error manejando mensaje", msg.id, err));
        }
      }
    }
    return;
  }

  res.writeHead(405).end();
});

server.listen(PORT, () => console.log(`Escuchando en el puerto ${PORT}`));
