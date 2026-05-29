/**
 * Models store with local persistence
 * 
 * Caches models data locally so it persists between sessions.
 * Loads from cache immediately, then refreshes in background if stale.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PopularModelsPayload } from "@knut/shared";
import { fetchPopularModels } from "./accountApi";

const STORAGE_KEY = "knut-models-cache";
const STALE_MS = 5 * 60 * 1000; // 5 minutes

type BenchmarkSource = "aa" | "blm";

type ModelsState = {
  dataBySource: Record<BenchmarkSource, PopularModelsPayload | null>;
  lastFetchedAtBySource: Record<BenchmarkSource, string | null>;
  isRefreshing: boolean;
  error: string | null;

  loadModels: (source: BenchmarkSource) => Promise<void>;
  refresh: (source: BenchmarkSource) => Promise<void>;
  clear: () => void;
};

function isStale(lastFetchedAt: string | null): boolean {
  if (!lastFetchedAt) return true;
  return Date.now() - new Date(lastFetchedAt).getTime() > STALE_MS;
}

export const useModelsStore = create<ModelsState>()((set, get) => ({
  dataBySource: { aa: null, blm: null },
  lastFetchedAtBySource: { aa: null, blm: null },
  isRefreshing: false,
  error: null,

  loadModels: async (source: BenchmarkSource) => {
    const state = get();

    // If we have fresh in-memory data, nothing to do
    if (state.dataBySource[source] && !isStale(state.lastFetchedAtBySource[source])) {
      return;
    }

    // Try loading from AsyncStorage
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_KEY}-${source}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        const lastFetchedAt = parsed.lastFetchedAt ?? null;
        set({
          dataBySource: { ...get().dataBySource, [source]: parsed.data },
          lastFetchedAtBySource: { ...get().lastFetchedAtBySource, [source]: lastFetchedAt },
        });

        // If cache is stale, refresh in background
        if (isStale(lastFetchedAt)) {
          void get().refresh(source);
        }
        return;
      }
    } catch {
      // Ignore cache errors
    }

    // No cache at all — fetch fresh
    await get().refresh(source);
  },

  refresh: async (source: BenchmarkSource) => {
    const state = get();
    if (state.isRefreshing) return;

    set({ isRefreshing: true, error: null });

    try {
      const payload = await fetchPopularModels(false, source);
      const lastFetchedAt = new Date().toISOString();
      
      await AsyncStorage.setItem(`${STORAGE_KEY}-${source}`, JSON.stringify({ data: payload, lastFetchedAt }));
      
      set({
        dataBySource: { ...state.dataBySource, [source]: payload },
        lastFetchedAtBySource: { ...state.lastFetchedAtBySource, [source]: lastFetchedAt },
        isRefreshing: false,
        error: null,
      });
    } catch (err) {
      set({
        isRefreshing: false,
        error: err instanceof Error ? err.message : "Model data could not load.",
      });
    }
  },

  clear: async () => {
    await AsyncStorage.removeItem(`${STORAGE_KEY}-aa`);
    await AsyncStorage.removeItem(`${STORAGE_KEY}-blm`);
    set({
      dataBySource: { aa: null, blm: null },
      lastFetchedAtBySource: { aa: null, blm: null },
      isRefreshing: false,
      error: null,
    });
  },
}));
