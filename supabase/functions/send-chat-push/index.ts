import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * send-chat-push — FCM HTTP v1 for Matchcard chat.
 *
 * Body: { message_id: string }
 * Auth (verify_jwt disabled — checked here):
 *   - Authorization: Bearer <user access token> (sender)
 *   - OR header x-matchcard-push-secret / body.push_secret matching CHAT_PUSH_HOOK_SECRET
 *
 * Secrets:
 *   FIREBASE_SERVICE_ACCOUNT_JSON
 *   CHAT_PUSH_HOOK_SECRET
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-matchcard-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ServiceAccount = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

type ChatRow = {
  id: string;
  team_player_id: string;
  parent_user_id: string;
  sender_user_id: string;
  sender_role: "coach" | "parent";
  body: string | null;
  created_at: string;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64url(data: string | ArrayBuffer) {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/=+/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function googleAccessToken(sa: ServiceAccount): Promise<string> {
  if (!sa.client_email || !sa.private_key) {
    throw new Error("bad_service_account");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const jwt = `${unsigned}.${b64url(sig)}`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`oauth:${tokenJson.error || tokenRes.status}`);
  }
  return String(tokenJson.access_token);
}

async function sendFcm(
  sa: ServiceAccount,
  accessToken: string,
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  const projectId = String(sa.project_id || "").trim();
  if (!projectId) throw new Error("no_project_id");
  const url =
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const collapse =
    String(data.broadcast_id || data.notice_id || data.message_id || "").trim();
  const androidNotification: Record<string, unknown> = {
    channel_id: "matchcard_alerts_v2",
    notification_priority: "PRIORITY_HIGH",
    default_sound: true,
  };
  if (collapse) androidNotification.tag = collapse.slice(0, 64);
  const android: Record<string, unknown> = {
    priority: "HIGH",
    notification: androidNotification,
  };
  if (collapse) android.collapse_key = collapse.slice(0, 64);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title, body },
        data,
        android,
      },
    }),
  });
  const payload = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, payload };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "method" });

  const saRaw = String(Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "").trim();
  if (!saRaw) {
    return json(503, { ok: false, error: "fcm_not_configured" });
  }
  let sa: ServiceAccount;
  try {
    sa = JSON.parse(saRaw);
  } catch {
    return json(500, { ok: false, error: "bad_service_account_json" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const hookSecret = String(Deno.env.get("CHAT_PUSH_HOOK_SECRET") || "").trim();
  if (!supabaseUrl || !supabaseAnon || !serviceKey) {
    return json(500, { ok: false, error: "supabase_env" });
  }

  let bodyJson: Record<string, unknown>;
  try {
    bodyJson = await req.json();
  } catch {
    return json(400, { ok: false, error: "bad_json" });
  }
  const messageId = String(bodyJson.message_id || "").trim();
  const noticeId = String(bodyJson.notice_id || "").trim();
  const broadcastId = String(bodyJson.broadcast_id || "").trim();
  if (!messageId && !noticeId && !broadcastId) {
    return json(400, { ok: false, error: "message_id_or_notice_id_or_broadcast_id" });
  }

  const headerSecret = String(
    req.headers.get("x-matchcard-push-secret") || bodyJson.push_secret || "",
  ).trim();
  const hookOk = !!(hookSecret && headerSecret && headerSecret === hookSecret);

  const authHeader = req.headers.get("Authorization") || "";
  let callerId = "";
  if (!hookOk) {
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { ok: false, error: "auth" });
    }
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return json(401, { ok: false, error: "auth" });
    }
    callerId = String(userData.user.id);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  async function deliver(
    recipientIds: Set<string>,
    title: string,
    text: string,
    data: Record<string, string>,
  ) {
    if (!recipientIds.size) {
      return json(200, { ok: true, sent: 0, reason: "no_recipients" });
    }
    const { data: tokens, error: tokErr } = await admin
      .from("device_tokens")
      .select("token,user_id,platform")
      .in("user_id", [...recipientIds]);
    if (tokErr) return json(500, { ok: false, error: tokErr.message });
    const list = (tokens || []).filter((t) => t && t.token);
    if (!list.length) {
      return json(200, { ok: true, sent: 0, reason: "no_tokens" });
    }
    let accessToken: string;
    try {
      accessToken = await googleAccessToken(sa);
    } catch (e) {
      return json(500, {
        ok: false,
        error: "oauth",
        detail: String((e as Error)?.message || e),
      });
    }
    const results = [];
    for (const row of list) {
      try {
        const r = await sendFcm(
          sa,
          accessToken,
          String(row.token),
          title,
          text,
          data,
        );
        results.push({
          user_id: row.user_id,
          ok: r.ok,
          status: r.status,
          error: r.ok ? null : r.payload,
        });
        if (
          !r.ok &&
          r.payload &&
          typeof r.payload === "object" &&
          JSON.stringify(r.payload).includes("UNREGISTERED")
        ) {
          await admin.from("device_tokens").delete().eq("token", row.token);
        }
      } catch (e) {
        results.push({
          user_id: row.user_id,
          ok: false,
          error: String((e as Error)?.message || e),
        });
      }
    }
    const sent = results.filter((r) => r.ok).length;
    return json(200, {
      ok: true,
      sent,
      results,
      via: hookOk ? "hook" : "user",
    });
  }

  if (noticeId) {
    const { data: notice, error: noticeErr } = await admin
      .from("parent_notices")
      .select("id,parent_user_id,team_player_id,notice_type,title,body")
      .eq("id", noticeId)
      .maybeSingle();
    if (noticeErr) return json(500, { ok: false, error: noticeErr.message });
    if (!notice) return json(404, { ok: false, error: "not_found" });
    if (!hookOk && callerId && String(notice.parent_user_id) === callerId) {
      return json(403, { ok: false, error: "forbidden" });
    }
    const recipientIds = new Set<string>();
    if (notice.parent_user_id) {
      recipientIds.add(String(notice.parent_user_id));
    }
    return await deliver(
      recipientIds,
      String(notice.title || "Matchcard").slice(0, 80) || "Matchcard",
      String(notice.body || "Новое уведомление").trim().slice(0, 180) ||
        "Новое уведомление",
      {
        type: String(notice.notice_type || "notice"),
        team_player_id: String(notice.team_player_id || ""),
        notice_id: String(notice.id || ""),
      },
    );
  }

  async function claimBroadcastParent(
    bc: string,
    parentUserId: string,
    msgId: string,
  ): Promise<boolean> {
    if (!bc || !parentUserId) return true;
    const { error } = await admin.from("chat_broadcast_pushes").insert({
      broadcast_id: bc,
      parent_user_id: parentUserId,
      message_id: msgId || bc,
    });
    if (!error) return true;
    // Unique violation → already woken this parent for this broadcast.
    const code = String((error as { code?: string }).code || "");
    if (code === "23505") return false;
    // Table missing / RLS — still deliver rather than drop the alert.
    return true;
  }

  /** One FCM wake per chat row — blocks client+trigger double-fire and poll loops. */
  async function claimMessagePush(msgId: string): Promise<boolean> {
    const id = String(msgId || "").trim();
    if (!id) return true;
    const { error } = await admin.from("chat_push_claims").insert({
      message_id: id,
    });
    if (!error) return true;
    const code = String((error as { code?: string }).code || "");
    if (code === "23505") return false;
    return true;
  }

  // One wake for every unique parent of a team broadcast.
  if (broadcastId && !messageId) {
    if (!hookOk && !callerId) {
      return json(401, { ok: false, error: "auth" });
    }
    const { data: rows, error: rowsErr } = await admin
      .from("player_chat_messages")
      .select("id,parent_user_id,team_player_id,body,broadcast_id,sender_user_id")
      .eq("broadcast_id", broadcastId)
      .limit(200);
    if (rowsErr) return json(500, { ok: false, error: rowsErr.message });
    const list = rows || [];
    if (!list.length) return json(404, { ok: false, error: "not_found" });
    if (!hookOk) {
      const senderOk = list.some((r) => String(r.sender_user_id) === callerId);
      if (!senderOk) return json(403, { ok: false, error: "forbidden" });
    }
    const bodyText =
      String(list[0].body || "Новое сообщение").trim().slice(0, 180) ||
      "Новое сообщение";
    const recipientIds = new Set<string>();
    let teamPlayerId = "";
    let repMessageId = "";
    for (const r of list) {
      const pid = String(r.parent_user_id || "");
      if (!pid) continue;
      const claimed = await claimBroadcastParent(
        broadcastId,
        pid,
        String(r.id || ""),
      );
      if (!claimed) continue;
      recipientIds.add(pid);
      if (!teamPlayerId) teamPlayerId = String(r.team_player_id || "");
      if (!repMessageId) repMessageId = String(r.id || "");
    }
    recipientIds.delete(String(list[0].sender_user_id || ""));
    if (callerId) recipientIds.delete(callerId);
    if (!recipientIds.size) {
      return json(200, {
        ok: true,
        sent: 0,
        skipped: "deduped_or_empty",
        broadcast_id: broadcastId,
      });
    }
    return await deliver(
      recipientIds,
      "Главный тренер",
      bodyText,
      {
        type: "chat",
        chat_kind: "team",
        broadcast_id: broadcastId,
        team_player_id: teamPlayerId,
        message_id: repMessageId || broadcastId,
      },
    );
  }

  const { data: msg, error: msgErr } = await admin
    .from("player_chat_messages")
    .select(
      "id,team_player_id,parent_user_id,sender_user_id,sender_role,body,broadcast_id,created_at",
    )
    .eq("id", messageId)
    .maybeSingle();
  if (msgErr) return json(500, { ok: false, error: msgErr.message });
  if (!msg) return json(404, { ok: false, error: "not_found" });

  const chat = msg as ChatRow & { broadcast_id?: string };
  if (!hookOk && String(chat.sender_user_id) !== callerId) {
    return json(403, { ok: false, error: "forbidden" });
  }

  const isTeam = !!String(chat.broadcast_id || "").trim();
  // Personal (and single-row) pushes: claim once so sync/trigger/client cannot loop.
  if (!isTeam) {
    const claimedMsg = await claimMessagePush(String(chat.id || messageId));
    if (!claimedMsg) {
      return json(200, { ok: true, sent: 0, skipped: "message_deduped" });
    }
  }

  const recipientIds = new Set<string>();
  if (chat.sender_role === "coach") {
    if (chat.parent_user_id) recipientIds.add(String(chat.parent_user_id));
  } else {
    const { data: player } = await admin
      .from("team_players")
      .select("id,team_id")
      .eq("id", chat.team_player_id)
      .maybeSingle();
    if (player?.team_id) {
      const { data: team } = await admin
        .from("teams")
        .select("id,academy_id")
        .eq("id", player.team_id)
        .maybeSingle();
      if (team?.academy_id) {
        const { data: academy } = await admin
          .from("academies")
          .select("owner_user_id")
          .eq("id", team.academy_id)
          .maybeSingle();
        if (academy?.owner_user_id) {
          recipientIds.add(String(academy.owner_user_id));
        }
        const { data: members } = await admin
          .from("memberships")
          .select("user_id,role,status,academy_id,team_id")
          .eq("status", "active")
          .in("role", ["owner", "assistant"]);
        (members || []).forEach((m) => {
          if (
            String(m.academy_id || "") === String(team.academy_id) ||
            String(m.team_id || "") === String(team.id)
          ) {
            if (m.user_id) recipientIds.add(String(m.user_id));
          }
        });
      }
    }
  }
  recipientIds.delete(String(chat.sender_user_id || ""));
  if (callerId) recipientIds.delete(callerId);

  if (isTeam && chat.parent_user_id) {
    const claimed = await claimBroadcastParent(
      String(chat.broadcast_id),
      String(chat.parent_user_id),
      String(chat.id),
    );
    if (!claimed) {
      return json(200, { ok: true, sent: 0, skipped: "broadcast_deduped" });
    }
  }

  return await deliver(
    recipientIds,
    isTeam ? "Главный тренер" : "Matchcard",
    String(chat.body || "Новое сообщение").trim().slice(0, 180) ||
      "Новое сообщение",
    {
      type: "chat",
      chat_kind: isTeam ? "team" : "personal",
      broadcast_id: String(chat.broadcast_id || ""),
      team_player_id: String(chat.team_player_id || ""),
      message_id: String(chat.id || ""),
    },
  );
});
