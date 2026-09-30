import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function csvRows(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const parse = (line: string) => {
    const values: string[] = []; let value = ""; let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
      else value += char;
    }
    values.push(value.trim()); return values;
  };
  const headers = parse(lines[0]).map(name => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return lines.slice(1).map(line => Object.fromEntries(headers.map((header, i) => [header, parse(line)[i] ?? ""])));
}

function swimTime(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw || /^(NT|DNS|DNF|DQ|SCR|NS)$/i.test(raw)) return null;
  const match = raw.match(/^(?:(\d+):)?(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0); const seconds = Number(match[2]);
  if (match[1] && seconds >= 60) return null;
  const ms = (minutes * 60 + seconds) * 1000 + Number((match[3] ?? "").padEnd(3, "0"));
  return Number.isSafeInteger(ms) ? ms : null;
}

function stableKey(value: string): string {
  let hash = 2166136261;
  for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function normalize(rows: Record<string, unknown>[], source: string) {
  const aliases: Record<string, string[]> = {
    source_identifier: ["source_identifier", "athlete_id", "swimmer_id", "competitor_id", "registration_id"],
    swimmer_name: ["swimmer_name", "athlete", "athlete_name", "name", "competitor", "swimmer"], country: ["country", "nation", "team"],
    country_code: ["country_code", "noc", "nation_code"], gender: ["gender", "sex"], event: ["event", "event_name", "race"],
    age_group: ["age_group", "age", "category_age"], course: ["course", "pool", "pool_length"], round_name: ["round", "round_name", "heat_final"],
    time_original: ["time", "time_original", "result", "mark"], placing: ["place", "placing", "position", "rank"], race_status: ["status", "race_status"],
    competition_category: ["competition_category", "category", "division"], is_relay: ["is_relay", "relay"], relay_team: ["relay_team", "team_name"],
  };
  return rows.map((raw, i) => {
    const get = (field: string) => { for (const key of aliases[field] ?? [field]) if (raw[key] != null && String(raw[key]).trim()) return String(raw[key]).trim(); return ""; };
    const name = get("swimmer_name"); const parts = name.split(/\s+/).filter(Boolean); const event = get("event"); const time = get("time_original");
    let status = get("race_status").toUpperCase().replace(/[^A-Z]/g, ""); if (!["DNS", "DNF", "DQ", "SCR", "NS"].includes(status)) status = /^(DNS|DNF|DQ|SCR|NS)$/i.test(time) ? time.toUpperCase() : "OK";
    const genderRaw = get("gender"); const gender = /^(m|male|men|man)$/i.test(genderRaw) ? "Men" : /^(f|female|women|woman)$/i.test(genderRaw) ? "Women" : null;
    const courseRaw = get("course").toUpperCase().replace(/[^A-Z]/g, ""); const course = ["LCM", "LONGCOURSE", "50M"].includes(courseRaw) ? "LCM" : ["SCM", "SHORTCOURSE", "25M"].includes(courseRaw) ? "SCM" : ["SCY", "YARDS", "25Y"].includes(courseRaw) ? "SCY" : null;
    const country = get("country") || null; const sourceIdentifier=get("source_identifier"); const identity = sourceIdentifier ? `source:${sourceIdentifier}` : `row:${i}|${country ?? "unknown"}|${name.toLocaleLowerCase()}`;
    const eventMatch = event.match(/(\d+)\s*m?\s*(freestyle|free|backstroke|back|breaststroke|breast|butterfly|fly|individual medley|medley)/i);
    const strokeKey = eventMatch?.[2]?.toLowerCase();
    const stroke = strokeKey ? ({ free:"Freestyle",freestyle:"Freestyle",back:"Backstroke",backstroke:"Backstroke",breast:"Breaststroke",breaststroke:"Breaststroke",fly:"Butterfly",butterfly:"Butterfly",medley:"Individual Medley","individual medley":"Individual Medley" } as Record<string,string>)[strokeKey] : null;
    return {
      source_row_key: stableKey(`${source}|${i}|${identity}|${event}|${get("round_name")}|${time}`), swimmer_source_key: stableKey(identity), swimmer_name: name || "Unknown swimmer",
      first_name: parts[0] ?? "", last_name: parts.slice(1).join(" "), country, country_code: get("country_code") || null, gender,
      event: event || "Unknown event", distance_m: eventMatch ? Number(eventMatch[1]) : null, stroke, age_group: get("age_group") || null,
      competition_category: get("competition_category") || null, course, round_name: get("round_name") || null, time_original: time || null,
      time_ms: status === "OK" ? swimTime(time) : null, placing: get("placing") || null, race_status: status,
      is_relay: /true|yes|relay/i.test(get("is_relay")) || /relay/i.test(event), relay_team: get("relay_team") || null, relay_members: [], raw_data: raw,
      source_references: [{ source, row: i + 2 }],
    };
  });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });
  const url = Deno.env.get("SUPABASE_URL"); const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return Response.json({ error: "Importer is not configured" }, { status: 500, headers: cors });
  const authorization = req.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Sign in required" }, { status: 401, headers: cors });
  const client = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return Response.json({ error: "Sign in required" }, { status: 401, headers: cors });
  const { data: allowed, error: permissionError } = await client.rpc("has_admin_permission", { p_permission: "import_results" });
  if (permissionError || !allowed) return Response.json({ error: "Import permission required" }, { status: 403, headers: cors });
  try {
    const body = await req.json(); const batchId = String(body.batchId ?? ""); const path = String(body.path ?? "");
    if (!batchId || !path.startsWith(`${batchId}/`)) return Response.json({ error: "Source file must belong to this import batch" }, { status: 400, headers: cors });
    const { data: file, error: downloadError } = await client.storage.from("admin-imports").download(path);
    if (downloadError || !file) return Response.json({ error: `Could not read source file: ${downloadError?.message ?? "missing file"}` }, { status: 400, headers: cors });
    if (file.size > 15 * 1024 * 1024) return Response.json({ error: "Source file exceeds the 15 MB limit" }, { status: 413, headers: cors });
    const extension = path.toLowerCase().split(".").pop(); const text = await file.text(); let rows: Record<string, unknown>[];
    if (extension === "csv") rows = csvRows(text);
    else if (extension === "json") {
      const parsed = JSON.parse(text); const list = Array.isArray(parsed) ? parsed : (Number(parsed.schema_version ?? 1) === 1 ? parsed.results ?? parsed.rows : null);
      if (!Array.isArray(list)) throw new Error("JSON must contain a version 1 results array.");
      rows = list.filter((row: unknown) => row && typeof row === "object");
    } else throw new Error("Automatic parsing supports CSV and version 1 JSON only. This file is stored privately for manual review.");
    if (!rows.length || rows.length > 20000) throw new Error("Source file must contain between 1 and 20,000 result rows.");
    const staged = normalize(rows, path.split("/").at(-1) ?? "source");
    const { data: stagedCount, error: stageError } = await client.rpc("admin_stage_import_rows", { p_batch_id: batchId, p_rows: staged });
    if (stageError) throw stageError;
    return Response.json({ batchId, rows: stagedCount, parser: extension, status: "review" }, { headers: cors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse this source file";
    return Response.json({ error: message }, { status: 422, headers: cors });
  }
});
