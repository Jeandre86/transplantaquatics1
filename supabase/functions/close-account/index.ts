import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return Response.json({ error: 'Sign in to close your account.' }, { status: 401, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return Response.json({ error: 'Account closure is not configured on the server.' }, { status: 503, headers: corsHeaders });

  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return Response.json({ error: 'Your session could not be verified. Sign in again and retry.' }, { status: 401, headers: corsHeaders });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) return Response.json({ error: 'Account closure failed. Please try again later.' }, { status: 500, headers: corsHeaders });

  return Response.json({ success: true }, { status: 200, headers: corsHeaders });
});
