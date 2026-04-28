/**
 * banproof.me — /api/subscribe
 * CF Pages Function — newsletter / waitlist email capture
 *
 * Bindings required (set in CF Pages dashboard → Settings → Functions → Bindings):
 *   send_email binding name: SEND_EMAIL
 *   destination_address: marstonr6@gmail.com
 *   KV namespace binding name: WAITLIST_KV  (optional — for dedup)
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'https://www.banproof.me',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  try {
    const body = await request.json();
    const { email, source } = body;

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(
        JSON.stringify({ ok: false, error: 'A valid email address is required.' }),
        { status: 422, headers: corsHeaders }
      );
    }

    const ip = request.headers.get('CF-Connecting-IP') || null;
    const submittedAt = new Date().toISOString();
    const entrySource = source || 'landing-cta';

    // Dedup check via KV
    if (env.WAITLIST_KV) {
      const existing = await env.WAITLIST_KV.get(`sub:${email}`);
      if (existing) {
        return new Response(
          JSON.stringify({ ok: true, already: true }),
          { status: 200, headers: corsHeaders }
        );
      }
      await env.WAITLIST_KV.put(`sub:${email}`, submittedAt);
    }

    // Notify via CF Email Routing
    if (env.SEND_EMAIL) {
      const subject = `[Banproof] New waitlist signup — ${email}`;
      const text = [
        `New waitlist subscription on banproof.me`,
        ``,
        `Email:    ${email}`,
        `Source:   ${entrySource}`,
        `IP:       ${ip || 'unknown'}`,
        `Time:     ${submittedAt}`,
      ].join('\n');

      const msg = new EmailMessage(
        'contact@banproof.me',
        env.DEST_EMAIL || 'marstonr6@gmail.com',
        {
          headers: { subject, 'Reply-To': email },
          text,
        }
      );
      await env.SEND_EMAIL.send(msg);
    } else {
      console.log('[subscribe] SEND_EMAIL binding not set. Would have sent notification for:', email);
    }

    // Store in D1 if available
    if (env.PLATFORM_DB) {
      await env.PLATFORM_DB.prepare(
        `INSERT OR IGNORE INTO lead_submissions (id, form_type, name, email, message, status, received_at, ip_address)
         VALUES (?, 'banproof-subscribe', '', ?, ?, 'new', datetime('now'), ?)`
      ).bind(
        crypto.randomUUID(), email,
        `Source: ${entrySource}`,
        ip
      ).run().catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });

  } catch (err) {
    console.error('subscribe error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Server error. Please try again.' }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://www.banproof.me',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
