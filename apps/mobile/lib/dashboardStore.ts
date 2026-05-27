/**
 * Dashboard store with local persistence
 * 
 * Caches dashboard data locally so it persists between sessions.
 * Shows cached data immediately, then refreshes in background.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DashboardPayload } from "@knut/shared";
import { fetchDashboard } from "./accountApi";

const STORAGE_KEY = "knut-dashboard-cache";

type DashboardState = {
  /** Cached dashboard data */
  data: DashboardPayload | null;
  /** ISO timestamp of last successful fetch */
  lastFetchedAt: string | null;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Last error message */
  error: string | null;

  /** Load from cache (called on mount) */
  loadFromCache: () => void;
  /** Fetch fresh data from API and update cache */
  refresh: () => Promise<void>;
  /** Clear cache (on logout) */
  clear: () => void;
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      data: null,
      lastFetchedAt: null,
      isRefreshing: false,
      error: null,

      loadFromCache: () => {
        // Data is automatically loaded by Zustand persist middleware
        // This is a no-op but kept for API compatibility
      },

      refresh: async () => {
        const state = get();
        if (state.isRefreshing) return;

        set({ isRefreshing: true, error: null });

        try {
          const payload = await fetchDashboard();
          set({
            data: payload,
            lastFetchedAt: new Date().toISOString(),
            isRefreshing: false,
            error: null,
          });
        } catch (err) {
          set({
            isRefreshing: false,
            error: err instanceof Error ? err.message : "Dashboard could not load.",
          });
        }
      },

      clear: () => {
        set({
          data: null,
          lastFetchedAt: null,
          isRefreshing: false,
          error: null,
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist data and timestamp, not loading states
      partialize: (state) => ({
        data: state.data,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);

/**
 * Check if cached data is stale (older than 5 minutes)
 */
export function isCacheStale(lastFetchedAt: string | null, maxAgeMs = 5 * 60 * 1000): boolean {
  if (!lastFetchedAt) return true;
  return Date.now() - new Date(lastFetchedAt).getTime() > maxAgeMs;
}
