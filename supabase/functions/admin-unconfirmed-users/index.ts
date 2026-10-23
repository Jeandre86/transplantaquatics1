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

  const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const pendingUsers: Record<string, unknown>[] = [];
  const perPage = 1000;
  try {
    for (let page = 1; ; page += 1) {
      const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data.users ?? [];
      for (const pending of users.filter(item => !item.email_confirmed_at && item.email)) {
        const metadata = pending.user_metadata ?? {};
        pendingUsers.push({
          id: pending.id,
          email: pending.email,
          first_name: typeof metadata.first_name === "string" ? metadata.first_name : null,
          last_name: typeof metadata.last_name === "string" ? metadata.last_name : null,
          account_role: typeof metadata.account_role === "string" ? metadata.account_role : null,
          created_at: pending.created_at,
        });
      }
      if (users.length < perPage) break;
    }
    pendingUsers.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return response(200, { users: pendingUsers, count: pendingUsers.length });
  } catch (error) {
    return response(500, { error: error instanceof Error ? error.message : "Could not load pending email confirmations." });
  }
});
