/**
 * Models store with local persistence
 * 
 * Caches models data locally so it persists between sessions.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PopularModelsPayload } from "@knut/shared";
import { fetchPopularModels } from "./accountApi";

const STORAGE_KEY = "knut-models-cache";

type BenchmarkSource = "aa" | "blm";

type ModelsState = {
  /** Cached models data by benchmark source */
  dataBySource: Record<BenchmarkSource, PopularModelsPayload | null>;
  /** ISO timestamp of last successful fetch by source */
  lastFetchedAtBySource: Record<BenchmarkSource, string | null>;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Last error message */
  error: string | null;

  /** Load models for a given source, using cache if available */
  loadModels: (source: BenchmarkSource) => Promise<void>;
  /** Force refresh models for a given source */
  refresh: (source: BenchmarkSource) => Promise<void>;
  /** Clear cache (on logout) */
  clear: () => void;
};

export const useModelsStore = create<ModelsState>()((set, get) => ({
  dataBySource: { aa: null, blm: null },
  lastFetchedAtBySource: { aa: null, blm: null },
  isRefreshing: false,
  error: null,

  loadModels: async (source: BenchmarkSource) => {
    const state = get();
    
    // If we have cached data, use it
    if (state.dataBySource[source]) {
      return;
    }

    // Try loading from AsyncStorage first
    try {
      const cached = await AsyncStorage.getItem(`${STORAGE_KEY}-${source}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({
          dataBySource: { ...get().dataBySource, [source]: parsed.data },
          lastFetchedAtBySource: { ...get().lastFetchedAtBySource, [source]: parsed.lastFetchedAt },
        });
        return;
      }
    } catch {
      // Ignore cache errors
    }

    // Otherwise fetch fresh data
    await get().refresh(source);
  },

  refresh: async (source: BenchmarkSource) => {
    const state = get();
    if (state.isRefreshing) return;

    set({ isRefreshing: true, error: null });

    try {
      const payload = await fetchPopularModels(false, source);
      const lastFetchedAt = new Date().toISOString();
      
      // Save to cache
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
