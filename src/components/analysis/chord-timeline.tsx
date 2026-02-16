"use client";

interface ChordTimelineProps {
  chords: { chord: string; time: number; duration: number }[];
  currentTime: number;
  duration: number;
}

const CHORD_COLORS = [
  "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  "bg-purple-500/20 text-purple-700 dark:text-purple-300",
  "bg-green-500/20 text-green-700 dark:text-green-300",
  "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  "bg-pink-500/20 text-pink-700 dark:text-pink-300",
  "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
  "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300",
  "bg-red-500/20 text-red-700 dark:text-red-300",
];

export function ChordTimeline({ chords, currentTime, duration }: ChordTimelineProps) {
  if (chords.length === 0 || duration === 0) return null;

  // Assign colors to unique chords
  const uniqueChords = [...new Set(chords.map((c) => c.chord))];
  const colorMap = new Map(
    uniqueChords.map((chord, i) => [chord, CHORD_COLORS[i % CHORD_COLORS.length]])
  );

  // Find currently active chord
  const activeChord = chords.find(
    (c) => currentTime >= c.time && currentTime < c.time + c.duration
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Chord Timeline</h3>
        {activeChord && (
          <span className="rounded-md bg-primary/10 px-2 py-1 text-sm font-bold text-primary">
            {activeChord.chord}
          </span>
        )}
      </div>
      <div className="relative h-10 rounded-lg border bg-card overflow-hidden">
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 transition-all duration-100"
          style={{ left: `${(currentTime / duration) * 100}%` }}
        />

        {/* Chord blocks */}
        {chords.map((chord, i) => {
          const left = (chord.time / duration) * 100;
          const width = (chord.duration / duration) * 100;
          const isActive =
            currentTime >= chord.time && currentTime < chord.time + chord.duration;

          return (
            <div
              key={i}
              className={`absolute top-0 bottom-0 flex items-center justify-center text-xs font-medium border-r border-background/50 ${
                colorMap.get(chord.chord)
              } ${isActive ? "ring-2 ring-primary z-5" : ""}`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${chord.chord} (${chord.time.toFixed(1)}s)`}
            >
              {width > 3 && <span className="truncate px-1">{chord.chord}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
