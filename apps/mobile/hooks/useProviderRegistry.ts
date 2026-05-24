import { useEffect, useState } from "react";
import type { ProviderRegistryOption } from "@knut/shared";
import { fetchProviderRegistry } from "../lib/accountApi";
import { useAuthSession } from "./useAuthSession";

export function useProviderRegistry() {
  const auth = useAuthSession();
  const [providers, setProviders] = useState<ProviderRegistryOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!auth.user) {
      setProviders([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    fetchProviderRegistry()
      .then((nextProviders) => {
        if (!mounted) return;
        setProviders(nextProviders);
        setError(null);
      })
      .catch((nextError) => {
        if (!mounted) return;
        setError(nextError instanceof Error ? nextError.message : "Provider registry could not load.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [auth.user?.id]);

  return {
    auth,
    providers,
    loading,
    error
  };
}
