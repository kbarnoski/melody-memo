import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

// localStorage keys (legacy — migrated to Supabase on first auth load)
const LS_BLOCKED = "resonance-blocked-shaders";
const LS_LOVED = "resonance-loved-shaders";
const LS_DELETED = "resonance-deleted-shaders";

interface ShaderPreferencesState {
  blocked: Set<string>;
  loved: Set<string>;
  deleted: Set<string>;
  loaded: boolean;

  load: () => Promise<void>;
  blockShader: (mode: string) => void;
  unblockShader: (mode: string) => void;
  loveShader: (mode: string) => void;
  unloveShader: (mode: string) => void;
  deleteShader: (mode: string) => void;
  undeleteShader: (mode: string) => void;
}

/** Read a Set<string> from localStorage, returning empty set on failure */
function readLS(key: string): Set<string> {
  if (typeof localStorage === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Write a Set<string> to localStorage */
function writeLS(key: string, set: Set<string>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch { /* full */ }
}

export const useShaderPreferences = create<ShaderPreferencesState>((set, get) => ({
  blocked: new Set(),
  loved: new Set(),
  deleted: new Set(),
  loaded: false,

  async load() {
    if (get().loaded) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Not authenticated — fall back to localStorage
      set({
        blocked: readLS(LS_BLOCKED),
        loved: readLS(LS_LOVED),
        deleted: readLS(LS_DELETED),
        loaded: true,
      });
      return;
    }

    // Authenticated — load from Supabase
    const { data: rows } = await supabase
      .from("user_shader_preferences")
      .select("shader_mode, status");

    const blocked = new Set<string>();
    const loved = new Set<string>();
    const deleted = new Set<string>();

    if (rows && rows.length > 0) {
      for (const row of rows) {
        if (row.status === "blocked") blocked.add(row.shader_mode);
        else if (row.status === "loved") loved.add(row.shader_mode);
        else if (row.status === "deleted") deleted.add(row.shader_mode);
      }
      set({ blocked, loved, deleted, loaded: true });
      return;
    }

    // No rows in Supabase — migrate from localStorage
    const lsBlocked = readLS(LS_BLOCKED);
    const lsLoved = readLS(LS_LOVED);
    const lsDeleted = readLS(LS_DELETED);

    const hasLocal = lsBlocked.size > 0 || lsLoved.size > 0 || lsDeleted.size > 0;
    if (hasLocal) {
      const upserts: { user_id: string; shader_mode: string; status: string }[] = [];
      for (const m of lsBlocked) upserts.push({ user_id: user.id, shader_mode: m, status: "blocked" });
      for (const m of lsLoved) upserts.push({ user_id: user.id, shader_mode: m, status: "loved" });
      for (const m of lsDeleted) upserts.push({ user_id: user.id, shader_mode: m, status: "deleted" });

      if (upserts.length > 0) {
        await supabase
          .from("user_shader_preferences")
          .upsert(upserts, { onConflict: "user_id,shader_mode" });
      }

      // Clear localStorage after successful migration
      try {
        localStorage.removeItem(LS_BLOCKED);
        localStorage.removeItem(LS_LOVED);
        localStorage.removeItem(LS_DELETED);
      } catch { /* ok */ }

      set({ blocked: lsBlocked, loved: lsLoved, deleted: lsDeleted, loaded: true });
    } else {
      set({ blocked, loved, deleted, loaded: true });
    }
  },

  blockShader(mode: string) {
    const state = get();
    const newBlocked = new Set(state.blocked);
    newBlocked.add(mode);
    // Remove from loved if present
    const newLoved = new Set(state.loved);
    newLoved.delete(mode);
    set({ blocked: newBlocked, loved: newLoved });

    // Persist
    _upsert(mode, "blocked");
  },

  unblockShader(mode: string) {
    const newBlocked = new Set(get().blocked);
    newBlocked.delete(mode);
    set({ blocked: newBlocked });
    _remove(mode);
  },

  loveShader(mode: string) {
    const state = get();
    const newLoved = new Set(state.loved);
    newLoved.add(mode);
    // Remove from blocked if present
    const newBlocked = new Set(state.blocked);
    newBlocked.delete(mode);
    set({ loved: newLoved, blocked: newBlocked });
    _upsert(mode, "loved");
  },

  unloveShader(mode: string) {
    const newLoved = new Set(get().loved);
    newLoved.delete(mode);
    set({ loved: newLoved });
    _remove(mode);
  },

  deleteShader(mode: string) {
    const state = get();
    const newDeleted = new Set(state.deleted);
    newDeleted.add(mode);
    // Remove from blocked (deleted supersedes)
    const newBlocked = new Set(state.blocked);
    newBlocked.delete(mode);
    const newLoved = new Set(state.loved);
    newLoved.delete(mode);
    set({ deleted: newDeleted, blocked: newBlocked, loved: newLoved });
    _upsert(mode, "deleted");
  },

  undeleteShader(mode: string) {
    const newDeleted = new Set(get().deleted);
    newDeleted.delete(mode);
    set({ deleted: newDeleted });
    _remove(mode);
  },
}));

// ─── Background Supabase helpers (fire-and-forget) ───

async function _upsert(mode: string, status: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // Fallback: write to localStorage for non-authed users
      _syncToLocalStorage();
      return;
    }
    await supabase
      .from("user_shader_preferences")
      .upsert(
        { user_id: user.id, shader_mode: mode, status },
        { onConflict: "user_id,shader_mode" },
      );
  } catch {
    _syncToLocalStorage();
  }
}

async function _remove(mode: string) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      _syncToLocalStorage();
      return;
    }
    await supabase
      .from("user_shader_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("shader_mode", mode);
  } catch {
    _syncToLocalStorage();
  }
}

/** Fallback: sync current store state to localStorage for non-authed users */
function _syncToLocalStorage() {
  const state = useShaderPreferences.getState();
  writeLS(LS_BLOCKED, state.blocked);
  writeLS(LS_LOVED, state.loved);
  writeLS(LS_DELETED, state.deleted);
}

// ─── Synchronous accessors for journey shader picker ───

/** Get user-blocked shaders synchronously (reads from Zustand store) */
export function getUserBlockedShaders(): Set<string> {
  return useShaderPreferences.getState().blocked;
}

/** Get user-deleted shaders synchronously (reads from Zustand store) */
export function getUserDeletedShaders(): Set<string> {
  return useShaderPreferences.getState().deleted;
}
