/**
 * Alerts store with local persistence
 * 
 * Caches alerts data locally so it persists between sessions.
 */

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AccountAlert } from "@knut/shared";
import { fetchAlerts, evaluateAlerts } from "./accountApi";

const STORAGE_KEY = "knut-alerts-cache";

type AlertsState = {
  /** Cached alerts */
  alerts: AccountAlert[];
  /** ISO timestamp of last successful fetch */
  lastFetchedAt: string | null;
  /** Whether a refresh is in progress */
  isRefreshing: boolean;
  /** Whether evaluation is in progress */
  isEvaluating: boolean;
  /** Last status message */
  message: string | null;
  /** Last error message */
  error: string | null;

  /** Load alerts from cache or fetch fresh */
  loadAlerts: () => Promise<void>;
  /** Evaluate alerts (creates new alerts if needed) */
  evaluate: () => Promise<void>;
  /** Clear cache (on logout) */
  clear: () => void;
};

export const useAlertsStore = create<AlertsState>()((set, get) => ({
  alerts: [],
  lastFetchedAt: null,
  isRefreshing: false,
  isEvaluating: false,
  message: null,
  error: null,

  loadAlerts: async () => {
    const state = get();
    if (state.isRefreshing) return;

    // Try loading from cache first
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        set({ alerts: parsed.alerts, lastFetchedAt: parsed.lastFetchedAt });
      }
    } catch {
      // Ignore cache errors
    }

    set({ isRefreshing: true, error: null });

    try {
      const alerts = await fetchAlerts();
      const lastFetchedAt = new Date().toISOString();
      
      // Save to cache
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ alerts, lastFetchedAt }));
      
      set({
        alerts,
        lastFetchedAt,
        isRefreshing: false,
        error: null,
      });
    } catch (err) {
      set({
        isRefreshing: false,
        error: err instanceof Error ? err.message : "Could not load alerts.",
      });
    }
  },

  evaluate: async () => {
    const state = get();
    if (state.isEvaluating) return;

    set({ isEvaluating: true, error: null, message: null });

    try {
      const result = await evaluateAlerts();
      const lastFetchedAt = new Date().toISOString();
      
      // Save to cache
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ alerts: result.alerts, lastFetchedAt }));
      
      set({
        alerts: result.alerts,
        lastFetchedAt,
        isEvaluating: false,
        message: result.created
          ? `${result.created} new alert${result.created === 1 ? "" : "s"} created.`
          : "No new alerts. Suspiciously peaceful.",
        error: null,
      });
    } catch (err) {
      set({
        isEvaluating: false,
        error: err instanceof Error ? err.message : "Could not evaluate alerts.",
      });
    }
  },

  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({
      alerts: [],
      lastFetchedAt: null,
      isRefreshing: false,
      isEvaluating: false,
      message: null,
      error: null,
    });
  },
}));
