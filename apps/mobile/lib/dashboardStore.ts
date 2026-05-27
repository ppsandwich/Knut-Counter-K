/**
 * Dashboard store with local persistence
 * 
 * Caches dashboard data locally so it persists between sessions.
 * Shows cached data immediately, then refreshes in background.
 */

import { create } from "zustand";
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
  loadFromCache: () => Promise<void>;
  /** Fetch fresh data from API and update cache */
  refresh: () => Promise<void>;
  /** Clear cache (on logout) */
  clear: () => void;
};

export const useDashboardStore = create<DashboardState>()((set, get) => ({
  data: null,
  lastFetchedAt: null,
  isRefreshing: false,
  error: null,

  loadFromCache: async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({ data: parsed.data, lastFetchedAt: parsed.lastFetchedAt });
      }
    } catch {
      // Ignore cache errors
    }
  },

  refresh: async () => {
    const state = get();
    if (state.isRefreshing) return;

    set({ isRefreshing: true, error: null });

    try {
      const payload = await fetchDashboard();
      const lastFetchedAt = new Date().toISOString();
      
      // Save to cache
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ data: payload, lastFetchedAt }));
      
      set({
        data: payload,
        lastFetchedAt,
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

  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({
      data: null,
      lastFetchedAt: null,
      isRefreshing: false,
      error: null,
    });
  },
}));

/**
 * Check if cached data is stale (older than 5 minutes)
 */
export function isCacheStale(lastFetchedAt: string | null, maxAgeMs = 5 * 60 * 1000): boolean {
  if (!lastFetchedAt) return true;
  return Date.now() - new Date(lastFetchedAt).getTime() > maxAgeMs;
}
