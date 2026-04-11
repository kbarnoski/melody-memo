import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from("journeys")
  .select("id, name, share_token, theme, recording_id, created_at")
  .order("created_at", { ascending: true });

if (error) { console.error(error); process.exit(1); }

console.log(`Total rows: ${data.length}\n`);
for (const row of data) {
  const builtinId = row.theme?.builtinJourneyId ?? null;
  const hasShareToken = !!row.share_token;
  console.log(`${row.name}`);
  console.log(`  id: ${row.id}`);
  console.log(`  builtinJourneyId: ${builtinId}`);
  console.log(`  share_token: ${row.share_token ?? "(none)"}`);
  console.log(`  theme keys: ${row.theme ? Object.keys(row.theme).join(", ") : "(null)"}`);
  console.log(`  created: ${row.created_at}`);
  console.log();
}
