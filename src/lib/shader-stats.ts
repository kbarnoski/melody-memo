import { MODE_META } from "@/lib/shaders";
import type { ShaderStats, ShaderStatEntry } from "@/components/audio/journey-feedback";

export interface CategoryBreakdown {
  category: string;
  total: number;
  active: number;
  used: number;
  totalUsage: number;
  coveragePct: number;
}

export interface ShaderAnalytics {
  totalShaders: number;
  activeShaders: number;
  usedShaders: number;
  coveragePercent: number;         // used / active * 100
  rotationScore: number;           // 0-100 evenness (low = clustered usage)
  neverUsed: { mode: string; label: string; category: string }[];
  leastUsed: { mode: string; label: string; count: number }[];  // bottom 20
  topUsed: { mode: string; label: string; count: number }[];    // top 10
  stalest: { mode: string; label: string; daysSince: number }[];
  categoryBreakdown: CategoryBreakdown[];
}

function getEntry(stats: ShaderStats, mode: string): ShaderStatEntry {
  return stats[mode] ?? { usageCount: 0, dualCount: 0, lovedCount: 0, blockedCount: 0, lastUsed: "", tertiaryCount: 0, totalJourneys: 0, totalDisplaySecs: 0 };
}

function totalCount(entry: ShaderStatEntry): number {
  return (entry.usageCount ?? 0) + (entry.dualCount ?? 0) + (entry.tertiaryCount ?? 0);
}

export function computeShaderAnalytics(
  stats: ShaderStats,
  blocked: Set<string>,
  deleted: Set<string>,
): ShaderAnalytics {
  const allShaders = MODE_META.filter(m => m.category !== "AI Imagery");
  const totalShaders = allShaders.length;

  const activeShaderList = allShaders.filter(m => !blocked.has(m.mode) && !deleted.has(m.mode));
  const activeShaders = activeShaderList.length;

  // Determine which active shaders have been used at all
  const usedShaderList = activeShaderList.filter(m => {
    const e = getEntry(stats, m.mode);
    return totalCount(e) > 0;
  });
  const usedShaders = usedShaderList.length;
  const coveragePercent = activeShaders > 0 ? Math.round((usedShaders / activeShaders) * 100) : 0;

  // Rotation score: coefficient of variation of usage counts across active shaders
  // 100 = perfectly even, 0 = all usage on one shader
  let rotationScore = 0;
  if (usedShaders > 1) {
    const counts = activeShaderList.map(m => totalCount(getEntry(stats, m.mode)));
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    if (mean > 0) {
      const variance = counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length;
      const cv = Math.sqrt(variance) / mean; // coefficient of variation
      // CV of 0 = perfect evenness (score 100), CV of 2+ = very skewed (score ~0)
      rotationScore = Math.round(Math.max(0, Math.min(100, 100 * (1 - cv / 2))));
    }
  } else if (usedShaders === 1 && activeShaders > 1) {
    rotationScore = 0; // only 1 shader used out of many
  }

  // Never used: active shaders with zero usage
  const neverUsed = activeShaderList
    .filter(m => totalCount(getEntry(stats, m.mode)) === 0)
    .map(m => ({ mode: m.mode, label: m.label, category: m.category }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));

  // Stalest: active shaders that HAVE been used, sorted by days since lastUsed
  const now = Date.now();
  const stalest = activeShaderList
    .filter(m => {
      const e = getEntry(stats, m.mode);
      return totalCount(e) > 0 && e.lastUsed;
    })
    .map(m => {
      const e = getEntry(stats, m.mode);
      const lastUsedMs = new Date(e.lastUsed).getTime();
      const daysSince = Math.floor((now - lastUsedMs) / (1000 * 60 * 60 * 24));
      return { mode: m.mode, label: m.label, daysSince };
    })
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 10);

  // Least used: bottom 20 active shaders that HAVE been used
  const leastUsed = activeShaderList
    .filter(m => totalCount(getEntry(stats, m.mode)) > 0)
    .map(m => ({ mode: m.mode, label: m.label, count: totalCount(getEntry(stats, m.mode)) }))
    .sort((a, b) => a.count - b.count)
    .slice(0, 20);

  // Top used: top 10
  const topUsed = activeShaderList
    .filter(m => totalCount(getEntry(stats, m.mode)) > 0)
    .map(m => ({ mode: m.mode, label: m.label, count: totalCount(getEntry(stats, m.mode)) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Category breakdown
  const categoryMap = new Map<string, { total: number; active: number; used: number; totalUsage: number }>();
  for (const m of allShaders) {
    const cat = m.category;
    if (!categoryMap.has(cat)) categoryMap.set(cat, { total: 0, active: 0, used: 0, totalUsage: 0 });
    const entry = categoryMap.get(cat)!;
    entry.total++;
    const isActive = !blocked.has(m.mode) && !deleted.has(m.mode);
    if (isActive) {
      entry.active++;
      const count = totalCount(getEntry(stats, m.mode));
      if (count > 0) {
        entry.used++;
        entry.totalUsage += count;
      }
    }
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      total: data.total,
      active: data.active,
      used: data.used,
      totalUsage: data.totalUsage,
      coveragePct: data.active > 0 ? Math.round((data.used / data.active) * 100) : 0,
    }))
    .sort((a, b) => b.coveragePct - a.coveragePct);

  return {
    totalShaders,
    activeShaders,
    usedShaders,
    coveragePercent,
    rotationScore,
    neverUsed,
    leastUsed,
    topUsed,
    stalest,
    categoryBreakdown,
  };
}
