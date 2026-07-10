import type { APIRoute } from "astro";

export const prerender = false;

// Only the hosted + embedded Studio origins may trigger a deploy.
const ALLOWED_ORIGINS = [
  "https://artofmany.sanity.studio",
  "https://www.sanity.io",
];

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export const OPTIONS: APIRoute = ({ request }) =>
  new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });

export const POST: APIRoute = async ({ request }) => {
  const headers = corsHeaders(request.headers.get("origin"));

  // Build-time env (locals.runtime.env throws on @astrojs/cloudflare 14); set SANITY_DEPLOY_HOOK as a Cloudflare build var.
  const hookUrl = import.meta.env.SANITY_DEPLOY_HOOK;

  if (!hookUrl) {
    return Response.json(
      { ok: false, error: "Deploy hook not configured" },
      { status: 500, headers },
    );
  }

  try {
    const res = await fetch(hookUrl, { method: "POST" });
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `HTTP ${res.status}` },
        { status: 502, headers },
      );
    }
    return Response.json({ ok: true }, { headers });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 502, headers },
    );
  }
};
