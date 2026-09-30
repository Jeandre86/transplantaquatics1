import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response(405, { error: "Method not allowed." });
  const authorization = req.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !anonKey || !serviceKey) return response(401, { error: "A valid signed-in session is required." });

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return response(401, { error: "Your session could not be verified." });

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return response(400, { error: "Invalid request body." }); }
  const action = String(payload.action ?? "");

  if (action === "invite_writer") {
    const { data: canManage, error: permissionError } = await userClient.rpc("has_admin_permission", { p_permission: "manage_writers" });
    if (permissionError || !canManage) return response(403, { error: "Writer management permission is required." });
    const email = String(payload.email ?? "").trim().toLowerCase();
    const displayName = String(payload.displayName ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2) return response(400, { error: "Enter a valid email address and writer name." });
    const origin = req.headers.get("Origin") ?? "";
    const allowedOrigins = (Deno.env.get("APP_ORIGINS") ?? "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5174,https://transplantaquatics.org")
      .split(",").map(value => value.trim()).filter(Boolean);
    if (!allowedOrigins.includes(origin)) return response(400, { error: "This site origin is not approved for writer invitations." });
    const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
      data: { first_name: displayName.split(/\s+/)[0], last_name: displayName.split(/\s+/).slice(1).join(" "), site_role: "writer" },
      redirectTo: `${origin}/writer`,
    });
    if (inviteError || !inviteData.user) return response(400, { error: inviteError?.message ?? "Supabase did not return the invited account." });
    const invitedUser = inviteData.user;
    const appMetadata = { ...invitedUser.app_metadata, site_role: "writer", must_change_password: true };
    const { error: metadataError } = await serviceClient.auth.admin.updateUserById(invitedUser.id, { app_metadata: appMetadata });
    if (metadataError) return response(500, { error: `Writer invite was sent, but account setup failed: ${metadataError.message}` });
    const { error: recordError } = await userClient.rpc("admin_invite_writer_record", {
      p_user_id: invitedUser.id, p_email: email, p_display_name: displayName,
    });
    if (recordError) return response(500, { error: `Writer invite was sent, but the writer record could not be saved: ${recordError.message}` });
    return response(200, { success: true, message: `Writer invitation sent to ${email}. They will set a password on first access.` });
  }

  if (action === "set_password") {
    const password = String(payload.password ?? "");
    if (password.length < 8) return response(400, { error: "Choose a password with at least 8 characters." });
    if (user.app_metadata?.site_role !== "writer" || user.app_metadata?.must_change_password !== true) {
      return response(403, { error: "This account does not require first-access writer setup." });
    }
    const { error: passwordError } = await userClient.auth.updateUser({ password });
    if (passwordError) return response(400, { error: passwordError.message });
    const { error: metadataError } = await serviceClient.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, site_role: "writer", must_change_password: false },
    });
    if (metadataError) return response(500, { error: `Password updated, but writer setup could not be completed: ${metadataError.message}` });
    const { error: writerError } = await serviceClient.from("site_writers").update({ status: "active", updated_at: new Date().toISOString() }).eq("user_id", user.id);
    if (writerError) return response(500, { error: `Password updated, but writer access could not be activated: ${writerError.message}` });
    return response(200, { success: true, message: "Password set. Your writer workspace is ready." });
  }

  if (action === "notify_submission") {
    const articleId = String(payload.articleId ?? "");
    const { data: article, error: articleError } = await userClient.from("site_articles")
      .select("id,title,slug,author_id,status").eq("id", articleId).maybeSingle();
    if (articleError || !article || article.author_id !== user.id || article.status !== "submitted") {
      return response(403, { error: "Only the author of a submitted article can send this notification." });
    }
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("WRITER_NOTIFICATION_FROM");
    if (!apiKey || !from) return response(200, { success: true, notificationSent: false, message: "Article submitted. Admin email notification needs RESEND_API_KEY and WRITER_NOTIFICATION_FROM configured." });
    const { data: admins, error: adminsError } = await serviceClient.from("admin_memberships").select("user_id")
      .eq("is_active", true).in("role", ["owner", "administrator"]);
    if (adminsError) return response(500, { error: `Article submitted, but admin recipients could not be loaded: ${adminsError.message}` });
    const recipients: string[] = [];
    for (const admin of admins ?? []) {
      const { data } = await serviceClient.auth.admin.getUserById(admin.user_id);
      if (data.user?.email) recipients.push(data.user.email);
    }
    if (!recipients.length) return response(200, { success: true, notificationSent: false, message: "Article submitted. No active admin email address was found." });
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://transplantaquatics.org";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [...new Set(recipients)], subject: `Article ready for review: ${article.title}`,
        html: `<p><strong>${escapeHtml(article.title)}</strong> has been submitted by ${escapeHtml(user.email ?? "a writer")}.</p><p><a href="${siteUrl}/admin">Open the admin moderation queue</a></p>`,
      }),
    });
    if (!res.ok) return response(502, { error: `Article submitted, but email delivery failed: ${await res.text()}` });
    return response(200, { success: true, notificationSent: true, message: "Admins have been emailed." });
  }

  return response(400, { error: "Unsupported writer workflow action." });
});

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
