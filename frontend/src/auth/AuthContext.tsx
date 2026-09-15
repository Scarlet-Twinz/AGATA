import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setAccessToken } from "../lib/api";

type User = {
  id: string;
  company_id: string;
  email: string;
  full_name: string;
};

type BillingEntitlements = {
  plan?: {
    code?: string;
    name?: string;
  };
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (companyName: string, fullName: string, email: string, password: string, acceptedTerms: boolean) => Promise<string>;
  refreshUser: () => Promise<User | null>;
  signOut: () => void;
};

const TOKEN_KEY = "agata_access_token";
const PLAN_CODE_KEY = "agata_billing_plan_code";
const PLAN_NAME_KEY = "agata_billing_plan_name";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function clearPlanBadge() {
  localStorage.removeItem(PLAN_CODE_KEY);
  localStorage.removeItem(PLAN_NAME_KEY);
  document.body.removeAttribute("data-agata-plan-code");
  document.body.removeAttribute("data-agata-plan-name");
}

async function syncPlanBadge() {
  try {
    const entitlements = await api<BillingEntitlements>("/billing/entitlements");
    const code = entitlements.plan?.code || "foundation";
    const name = entitlements.plan?.name || "AGATA Foundation";
    localStorage.setItem(PLAN_CODE_KEY, code);
    localStorage.setItem(PLAN_NAME_KEY, name);
    document.body.dataset.agataPlanCode = code;
    document.body.dataset.agataPlanName = name;
  } catch {
    const code = localStorage.getItem(PLAN_CODE_KEY) || "foundation";
    const name = localStorage.getItem(PLAN_NAME_KEY) || "AGATA Foundation";
    document.body.dataset.agataPlanCode = code;
    document.body.dataset.agataPlanName = name;
  }
}

async function loadUser(token: string) {
  setAccessToken(token);
  return api<User>("/auth/me");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      clearPlanBadge();
      setLoading(false);
      return;
    }

    loadUser(token)
      .then(async (nextUser) => {
        setUser(nextUser);
        await syncPlanBadge();
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setAccessToken(null);
        clearPlanBadge();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      void syncPlanBadge();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [user]);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      clearPlanBadge();
      setUser(null);
      return null;
    }

    const nextUser = await loadUser(token);
    setUser(nextUser);
    await syncPlanBadge();
    return nextUser;
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn: async (email, password) => {
      const result = await api<{ access_token: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_KEY, result.access_token);
      setUser(await loadUser(result.access_token));
      await syncPlanBadge();
    },
    signUp: async (companyName, fullName, email, password, acceptedTerms) => {
      const result = await api<{ message: string }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          company_name: companyName,
          full_name: fullName,
          email,
          password,
          accepted_terms: acceptedTerms,
        }),
      });
      return result.message;
    },
    refreshUser,
    signOut() {
      localStorage.removeItem(TOKEN_KEY);
      setAccessToken(null);
      clearPlanBadge();
      setUser(null);
    },
  }), [user, loading, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
