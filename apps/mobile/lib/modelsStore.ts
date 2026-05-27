/**
 * Models store with local persistence
 * 
 * Caches models data locally so it persists between sessions.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
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

export const useModelsStore = create<ModelsState>()(
  persist(
    (set, get) => ({
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

        // Otherwise fetch fresh data
        await get().refresh(source);
      },

      refresh: async (source: BenchmarkSource) => {
        const state = get();
        if (state.isRefreshing) return;

        set({ isRefreshing: true, error: null });

        try {
          const payload = await fetchPopularModels(false, source);
          set({
            dataBySource: { ...state.dataBySource, [source]: payload },
            lastFetchedAtBySource: { ...state.lastFetchedAtBySource, [source]: new Date().toISOString() },
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

      clear: () => {
        set({
          dataBySource: { aa: null, blm: null },
          lastFetchedAtBySource: { aa: null, blm: null },
          isRefreshing: false,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist data and timestamps
      partialize: (state) => ({
        dataBySource: state.dataBySource,
        lastFetchedAtBySource: state.lastFetchedAtBySource,
      }),
    }
  )
);
