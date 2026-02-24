"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Calendar } from "lucide-react";
import { toast } from "sonner";

interface EditableDateProps {
  recordingId: string;
  recordedAt: string | null;
  createdAt: string;
}

function formatDateDisplay(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function toInputValue(dateString: string): string {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${month}/${day}/${year}`;
}

function parseInput(value: string): Date | null {
  // Accept MM/DD/YYYY
  const parts = value.split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 2000) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

export function EditableDate({ recordingId, recordedAt, createdAt }: EditableDateProps) {
  const [editing, setEditing] = useState(false);
  const [currentDate, setCurrentDate] = useState(recordedAt || createdAt);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select();
    }
  }, [editing]);

  function startEditing() {
    setInputValue(toInputValue(currentDate));
    setEditing(true);
  }

  async function handleSubmit() {
    const parsed = parseInput(inputValue);
    if (!parsed) {
      toast.error("Invalid date — use MM/DD/YYYY");
      return;
    }

    setEditing(false);
    const newDate = parsed.toISOString();
    if (newDate === currentDate) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("recordings")
      .update({ recorded_at: newDate })
      .eq("id", recordingId);

    if (error) {
      toast.error("Failed to update date");
    } else {
      setCurrentDate(newDate);
      toast.success("Date updated");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      setEditing(false);
    }
  }

  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground">
      <Calendar className="h-3.5 w-3.5" />
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleSubmit}
          onKeyDown={handleKeyDown}
          placeholder="MM/DD/YYYY"
          className="bg-transparent outline-none border-b border-primary w-28"
        />
      ) : (
        <button
          onClick={startEditing}
          className="hover:text-foreground transition-colors cursor-text"
        >
          Recorded {formatDateDisplay(currentDate)}
        </button>
      )}
    </span>
  );
}
