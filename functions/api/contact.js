/**
 * banproof.me — /api/contact
 * CF Pages Function — wired to Cloudflare Email Routing
 *
 * Bindings required (set in CF Pages dashboard → Settings → Functions → Bindings):
 *   send_email binding name: SEND_EMAIL
 *   destination_address: marstonr6@gmail.com  (or your preferred address)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS headers
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = ['https://banproof.me', 'https://www.banproof.me'];
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://www.banproof.me',
  };

  try {
    const body = await request.json();
    const { name, email, tier, notes } = body;

    if (!name || !email) {
      return new Response(JSON.stringify({ ok: false, error: 'Name and email are required.' }), { status: 422, headers });
    }

    // Validate email format
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid email address.' }), { status: 422, headers });
    }

    // Build email content
    const subject = `[Banproof] New request — ${tier || 'general'} — ${name}`;
    const text = [
      `New contact request from banproof.me`,
      ``,
      `Name:      ${name}`,
      `Email:     ${email}`,
      `Plan:      ${tier || 'not specified'}`,
      `Use case:  ${notes || 'not provided'}`,
      ``,
      `Submitted: ${new Date().toISOString()}`,
    ].join('\n');

    // Send via CF Email Routing
    if (env.SEND_EMAIL) {
      const msg = new EmailMessage(
        'contact@banproof.me',   // from (must be a verified sender in CF Email Routing)
        env.DEST_EMAIL || 'marstonr6@gmail.com',
        {
          headers: {
            subject,
            'Reply-To': email,
          },
          text,
        }
      );
      await env.SEND_EMAIL.send(msg);
    } else {
      // Fallback: log to console if binding not set
      console.log('SEND_EMAIL binding not set. Would have sent:', { subject, to: email });
    }

    // Also store in D1 if available
    if (env.PLATFORM_DB) {
      await env.PLATFORM_DB.prepare(
        `INSERT INTO lead_submissions (id, form_type, name, email, message, status, received_at, ip_address)
         VALUES (?, 'banproof-contact', ?, ?, ?, 'new', datetime('now'), ?)`
      ).bind(
        crypto.randomUUID(), name, email,
        `Plan: ${tier || 'n/a'}\nNotes: ${notes || 'n/a'}`,
        request.headers.get('CF-Connecting-IP') || null
      ).run().catch(() => {}); // non-fatal if D1 not wired
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  } catch (err) {
    console.error('contact error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Server error.' }), { status: 500, headers });
  }
}

export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  const allowedOrigins = ['https://banproof.me', 'https://www.banproof.me'];
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'https://www.banproof.me',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
