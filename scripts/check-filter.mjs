import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Replicate exactly what journey-selector does
const { data, error } = await supabase
  .from("journeys")
  .select("*")
  .order("created_at", { ascending: false });

if (error) { console.error(error); process.exit(1); }

console.log(`Total rows: ${data.length}\n`);

// This is the filter from journey-selector.tsx
const filtered = data.filter(row => {
  const theme = row.theme;
  return !theme?.builtinJourneyId;
});

console.log(`After filter (shown in UI): ${filtered.length}\n`);
for (const row of filtered) {
  console.log(`  ${row.name} — id: ${row.id} — theme: ${JSON.stringify(row.theme)}`);
}
