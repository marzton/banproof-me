export interface Env {
  AUDIT_DB: D1Database;
  TELEMETRY_STORE: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/orders') {
      try {
        const order = await request.json<{ product: string, amount: number, user: string }>();
        const orderId = crypto.randomUUID();

        // Log to audit db
        await env.AUDIT_DB.prepare(
          `INSERT INTO worker_audit (id, ts, worker, action, result, detail) VALUES (?, datetime('now'), 'armsway-com', 'order', 'ok', ?)`
        ).bind(orderId, JSON.stringify(order)).run();

        // Pipe transaction log to telemetry storage
        const logContent = JSON.stringify({ orderId, timestamp: new Date().toISOString(), ...order });
        await env.TELEMETRY_STORE.put(`transactions/${orderId}.json`, logContent);

        return new Response(JSON.stringify({ success: true, orderId }), { status: 200 });
      } catch (e) {
        console.error('Failed to process /api/orders request', e);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response('Armsway E-Commerce API', { status: 200 });
  }
}
