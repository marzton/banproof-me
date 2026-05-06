export interface Env {
  SIGNALS_DB: D1Database;
  DISCORD_WEBHOOK_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/trigger-atc') {
      try {
        const body = await request.json<{ signal: string, action: string, symbol: string }>();
        if (body.action === 'Buy') {
          // Log to signals db
          await env.SIGNALS_DB.prepare(
            `INSERT INTO signals (id, user_id, type, score, metadata) VALUES (?, ?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), 'system', 'ATC', 1.0, JSON.stringify(body)).run();

          // Discord Notification
          if (env.DISCORD_WEBHOOK_URL) {
            await fetch(env.DISCORD_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: `StellarAIO Triggered: Buy ${body.symbol}` })
            });
          }

          return new Response(JSON.stringify({ success: true, message: 'ATC Triggered and Notified' }), { status: 200 });
        }
        return new Response(JSON.stringify({ success: false, message: 'Not a Buy signal' }), { status: 400 });
      } catch (e) {
        return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
      }
    }
    return new Response('Not found', { status: 404 });
  }
}
