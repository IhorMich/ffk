import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "method" });
  }

  const resendKey = String(Deno.env.get("RESEND_API_KEY") || "").trim();
  if (!resendKey) {
    return json(503, { ok: false, error: "resend_not_configured" });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json(401, { ok: false, error: "auth" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !supabaseAnon) {
    return json(500, { ok: false, error: "supabase_env" });
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return json(401, { ok: false, error: "auth" });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "bad_json" });
  }

  const to = String(payload.to || "").trim().toLowerCase();
  const childName = String(payload.childName || "").trim().slice(0, 80);
  const codeRaw = String(payload.code || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const code = codeRaw.startsWith("MC-") ? codeRaw : (codeRaw ? `MC-${codeRaw}` : "");
  const link = String(payload.link || "").trim().slice(0, 500);
  const teamName = String(payload.teamName || "").trim().slice(0, 80);
  const coachName = String(payload.coachName || "").trim().slice(0, 80);

  if (!isEmail(to) || !code) {
    return json(400, { ok: false, error: "bad_input" });
  }

  const from =
    String(Deno.env.get("RESEND_FROM") || "").trim() ||
    "Matchcard <onboarding@resend.dev>";

  const subject = childName
    ? `Matchcard — приглашение родителя (${childName})`
    : "Matchcard — приглашение родителя";

  const textLines = [
    "Matchcard — приглашение родителя",
    childName ? `Игрок: ${childName}` : "",
    teamName ? `Команда: ${teamName}` : "",
    coachName ? `Тренер: ${coachName}` : "",
    "",
    `Код: ${code}`,
    "",
    "Откройте Matchcard → Игрок → Добавить по QR / ссылке",
    "и введите этот код.",
    link ? "" : "",
    link ? `Или откройте ссылку: ${link}` : "",
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px">Matchcard</h2>
      <p style="margin:0 0 8px">Приглашение родителя${childName ? ` для <b>${escapeHtml(childName)}</b>` : ""}.</p>
      ${teamName ? `<p style="margin:0 0 8px">Команда: ${escapeHtml(teamName)}</p>` : ""}
      ${coachName ? `<p style="margin:0 0 8px">Тренер: ${escapeHtml(coachName)}</p>` : ""}
      <p style="margin:16px 0;padding:14px 16px;border-radius:12px;background:#f4f4f5;font-size:22px;font-weight:700;letter-spacing:.04em">${escapeHtml(code)}</p>
      <p style="margin:0 0 8px">Откройте Matchcard → <b>Игрок</b> → <b>Добавить по QR / ссылке</b> и введите этот код.</p>
      ${link ? `<p style="margin:12px 0 0"><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>` : ""}
    </div>
  `;

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: textLines.join("\n"),
      html,
    }),
  });

  const resendBody = await resendRes.json().catch(() => ({}));
  if (!resendRes.ok) {
    console.error("resend_error", resendRes.status, resendBody);
    return json(502, {
      ok: false,
      error: "resend_failed",
      detail: String((resendBody && (resendBody.message || resendBody.name)) || resendRes.status),
    });
  }

  return json(200, {
    ok: true,
    id: resendBody && resendBody.id ? resendBody.id : null,
    to,
    code,
  });
});
