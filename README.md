# whatsapp-agente

Agente de WhatsApp del Sindicato de Taxistas de Playa del Carmen. Usa la WhatsApp Business Cloud API oficial de Meta y Claude para contestar. Pensado para Railway.

- `src/server.js`: webhook (`GET /webhook` para la verificación de Meta, `POST /webhook` para los mensajes).
- `src/whatsapp.js`: envío de mensajes por la Graph API.
- `src/agent.js`: el "cerebro". Contesta con Claude, recordando la conversación de cada usuario (se reinicia tras 30 min sin mensajes).
- `knowledge/sindicato.md`: **la información del sindicato**. El agente solo contesta con lo que esté aquí; edítalo para cambiar lo que sabe.

## Variables de entorno

| Variable | Qué es |
| --- | --- |
| `WHATSAPP_TOKEN` | Token de acceso (temporal para pruebas, permanente de System User en producción) |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID de la pantalla API Setup |
| `WEBHOOK_VERIFY_TOKEN` | Una frase secreta que tú inventas; la misma va en Meta |
| `META_APP_SECRET` | App Settings → Basic → App Secret. Valida que los webhooks vengan de Meta |
| `ANTHROPIC_API_KEY` | Clave de la API de Claude ([console.anthropic.com](https://console.anthropic.com)) |
| `CLAUDE_MODEL` | Opcional, por defecto `claude-opus-5-5` |
| `CLAUDE_EFFORT` | Opcional, por defecto `low` (respuestas rápidas) |
| `GRAPH_API_VERSION` | Opcional, por defecto `v21.0` |

Los valores reales van solo en Railway, nunca en el repo.

## Desplegar en Railway

1. En [railway.com](https://railway.com), **New Project → Deploy from GitHub repo** y elige `whatsapp-agente`.
2. En **Variables**, agrega las de la tabla.
3. En **Settings → Networking**, pulsa **Generate Domain**. Tu webhook queda en `https://<tu-dominio>.up.railway.app/webhook`.

## Conectar el webhook en Meta

1. En tu app de developers.facebook.com, ve a **WhatsApp → Configuration → Webhook → Edit**.
2. Callback URL: `https://<tu-dominio>.up.railway.app/webhook`. Verify token: el mismo valor de `WEBHOOK_VERIFY_TOKEN`.
3. Pulsa **Verify and save** y luego, en **Webhook fields**, suscríbete a `messages`.
4. Escríbele al número de prueba desde tu celular (registrado como destinatario). Debe contestarte.

## Probar en local

```sh
WEBHOOK_VERIFY_TOKEN=prueba npm start
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=prueba&hub.challenge=123"
```
