"use client";

import { Button } from "@/components/ui/button";

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const PROMPTS = [
  "What genre or style does this suggest?",
  "How could I develop a B section from these chords?",
  "What chord substitutions would add color?",
  "What scales work over this progression?",
  "Is there a common song form this fits?",
  "What did I play? Summarize the musical content.",
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Suggested questions:</p>
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="sm"
            className="text-xs hover:border-primary/30"
            onClick={() => onSelect(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}
