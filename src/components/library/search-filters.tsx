"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const KEYS = [
  "C Major", "C Minor", "C# Major", "C# Minor",
  "D Major", "D Minor", "D# Major", "D# Minor",
  "E Major", "E Minor", "F Major", "F Minor",
  "F# Major", "F# Minor", "G Major", "G Minor",
  "G# Major", "G# Minor", "A Major", "A Minor",
  "A# Major", "A# Minor", "B Major", "B Minor",
];

export function SearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [keyFilter, setKeyFilter] = useState(searchParams.get("key") ?? "");
  const [tempoRange, setTempoRange] = useState<[number, number]>([
    parseInt(searchParams.get("tempoMin") ?? "0"),
    parseInt(searchParams.get("tempoMax") ?? "300"),
  ]);
  const [tagFilter, setTagFilter] = useState(searchParams.get("tag") ?? "");
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.from("tags").select("*").order("name").then(({ data }) => {
      if (data) setTags(data);
    });
  }, []);

  function applyFilters() {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (keyFilter) params.set("key", keyFilter);
    if (tagFilter) params.set("tag", tagFilter);
    if (tempoRange[0] > 0) params.set("tempoMin", tempoRange[0].toString());
    if (tempoRange[1] < 300) params.set("tempoMax", tempoRange[1].toString());

    router.push(`/library?${params.toString()}`);
  }

  function clearFilters() {
    setQuery("");
    setKeyFilter("");
    setTagFilter("");
    setTempoRange([0, 300]);
    router.push("/library");
  }

  const hasFilters = query || keyFilter || tagFilter || tempoRange[0] > 0 || tempoRange[1] < 300;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search recordings..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
          className="pl-9"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1">
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs">
                !
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-4" align="end">
          <div className="space-y-2">
            <label className="text-sm font-medium">Key</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={keyFilter}
              onChange={(e) => setKeyFilter(e.target.value)}
            >
              <option value="">Any key</option>
              {KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tag</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            >
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Tempo: {tempoRange[0]}–{tempoRange[1]} BPM
            </label>
            <Slider
              min={0}
              max={300}
              step={5}
              value={tempoRange}
              onValueChange={(v) => setTempoRange(v as [number, number])}
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={applyFilters} className="flex-1">
              Apply
            </Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
