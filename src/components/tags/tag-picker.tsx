"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { TagBadge } from "./tag-badge";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";

interface TagPickerProps {
  recordingId: string;
  initialTags?: { id: string; name: string; color: string }[];
}

export function TagPicker({ recordingId, initialTags = [] }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(initialTags);
  const [allTags, setAllTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadAllTags();
  }, []);

  async function loadAllTags() {
    const supabase = createClient();
    const { data } = await supabase.from("tags").select("*").order("name");
    if (data) setAllTags(data);
  }

  async function addTag(tagId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("recording_tags")
      .insert({ recording_id: recordingId, tag_id: tagId });

    if (error) {
      toast.error("Failed to add tag");
      return;
    }

    const tag = allTags.find((t) => t.id === tagId);
    if (tag) setTags((prev) => [...prev, tag]);
    setOpen(false);
  }

  async function removeTag(tagId: string) {
    const supabase = createClient();
    await supabase
      .from("recording_tags")
      .delete()
      .eq("recording_id", recordingId)
      .eq("tag_id", tagId);

    setTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  async function createAndAddTag() {
    if (!search.trim()) return;

    const supabase = createClient();
    const colors = ["red", "blue", "green", "purple", "orange", "pink", "cyan", "yellow"];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newTag, error } = await supabase
      .from("tags")
      .insert({ name: search.trim(), color, user_id: user.id })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create tag");
      return;
    }

    await addTag(newTag.id);
    setAllTags((prev) => [...prev, newTag]);
    setSearch("");
  }

  const availableTags = allTags.filter(
    (t) => !tags.some((existing) => existing.id === t.id)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <TagBadge
          key={tag.id}
          name={tag.name}
          color={tag.color}
          onRemove={() => removeTag(tag.id)}
        />
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" />
            <Tag className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search or create tag..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>
                <button
                  className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={createAndAddTag}
                >
                  Create &quot;{search}&quot;
                </button>
              </CommandEmpty>
              <CommandGroup>
                {availableTags.map((tag) => (
                  <CommandItem key={tag.id} onSelect={() => addTag(tag.id)}>
                    <TagBadge name={tag.name} color={tag.color} />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
