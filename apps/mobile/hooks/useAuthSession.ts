import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { syncAccountProfile } from "../lib/accountApi";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type AuthSessionState = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signInWithEmail(email: string, password: string): Promise<{ error: string | null }>;
  signUpWithEmail(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
};

export function useAuthSession(): AuthSessionState {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  async function syncProfileIfSignedIn(nextSession: Session | null) {
    if (!nextSession) return;

    try {
      await syncAccountProfile();
    } catch (error) {
      console.warn("Account profile sync failed", error);
    }
  }

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      void syncProfileIfSignedIn(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      void syncProfileIfSignedIn(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return {
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    async signInWithEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signUpWithEmail(email, password) {
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    },
    async signOut() {
      await supabase.auth.signOut();
    }
  };
}
