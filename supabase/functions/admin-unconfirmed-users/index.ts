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

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response(405, { error: "Method not allowed." });

  const authorization = request.headers.get("Authorization");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization || !url || !anonKey || !serviceKey) return response(401, { error: "A valid signed-in admin session is required." });

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return response(401, { error: "Your session could not be verified." });

  const { data: allowed, error: permissionError } = await userClient.rpc("has_admin_permission", { p_permission: "manage_roles" });
  if (permissionError || !allowed) return response(403, { error: "Team management permission is required." });

  let body: { action?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return response(400, { error: "A valid request body is required." });
  }

  const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (body.action === "resend") {
    if (!body.userId) return response(400, { error: "A signup account ID is required." });
    const { data: userResult, error: lookupError } = await serviceClient.auth.admin.getUserById(body.userId);
    if (lookupError || !userResult.user) return response(404, { error: "Signup account not found." });
    const target = userResult.user;
    if (!target.email) return response(400, { error: "This account does not have an email address." });
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://transplantaquatics.vercel.app";
    let emailRedirectTo: string;
    try {
      const parsedSiteUrl = new URL(siteUrl);
      if (parsedSiteUrl.protocol !== "https:" || parsedSiteUrl.hostname === "localhost") throw new Error("Invalid production site URL.");
      emailRedirectTo = new URL(target.email_confirmed_at ? "/login" : "/join", parsedSiteUrl).toString();
    } catch {
      return response(500, { error: "The production email redirect is not configured correctly." });
    }

    if (target.email_confirmed_at) {
      const { error: signInError } = await serviceClient.auth.signInWithOtp({
        email: target.email,
        options: { shouldCreateUser: false, emailRedirectTo },
      });
      if (signInError) return response(400, { error: signInError.message });
      return response(200, { success: true, kind: "signin", email: target.email });
    }

    const { error: resendError } = await serviceClient.auth.resend({
      type: "signup",
      email: target.email,
      options: { emailRedirectTo },
    });
    if (resendError) return response(400, { error: resendError.message });
    return response(200, { success: true, kind: "confirmation", email: target.email });
  }

  if (body.action && body.action !== "list") return response(400, { error: "Unsupported action." });

  const signupUsers: Record<string, unknown>[] = [];
  const perPage = 1000;
  try {
    for (let page = 1; ; page += 1) {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const authUsers = data.users ?? [];
      for (const authUser of authUsers.filter(item => item.email)) {
        const metadata = authUser.user_metadata ?? {};
        signupUsers.push({
          id: authUser.id,
          email: authUser.email,
          first_name: typeof metadata.first_name === "string" ? metadata.first_name : null,
          last_name: typeof metadata.last_name === "string" ? metadata.last_name : null,
          account_role: typeof metadata.account_role === "string" ? metadata.account_role : null,
          created_at: authUser.created_at,
          email_confirmed_at: authUser.email_confirmed_at ?? null,
        });
      }
      if (authUsers.length < perPage) break;
    }
    signupUsers.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const pendingCount = signupUsers.filter(item => !item.email_confirmed_at).length;
    return response(200, { users: signupUsers, count: signupUsers.length, pending_count: pendingCount });
  } catch (error) {
    return response(500, { error: error instanceof Error ? error.message : "Could not load signup accounts." });
  }
});
