// ============================================================================
// Sphere AI — Auth Store (Zustand)
// Port of account_provider.dart + UserNotifier
// ============================================================================

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, Account } from "@/lib/types";
import { apiClient } from "@/lib/api-client";

interface AuthState {
  // Hydration flag — true once Zustand has restored persisted state from localStorage.
  // Components MUST check this before making routing decisions based on `user`.
  _hasHydrated: boolean;
  // Current user (null = not logged in)
  user: User | null;
  // All saved accounts (multi-account support)
  accounts: Account[];
  // Currently active account
  activeAccount: Account | null;
  // Loading states
  isLoading: boolean;
  error: string | null;

  // ── Actions ─────────────────────────────────────────────────────────
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  switchAccount: (account: Account) => void;
  removeAccount: (accountId: string) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
  hydrateFromStorage: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      user: null,
      accounts: [],
      activeAccount: null,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await apiClient.login(username, password);
          const token = data.access_token;

          // Fetch profile to get full user info
          const profile = await apiClient.getProfile();

          // Read the server URL from what the gateway/user configured
          const serverUrl = apiClient.getServerUrl() || "local";

          const account: Account = {
            id: `${username}@${serverUrl}`,
            username,
            email: profile.email || "",
            serverUrl,
            token,
          };

          const { accounts } = get();
          const updatedAccounts = [
            ...accounts.filter((a) => a.id !== account.id),
            account,
          ];

          set({
            user: profile,
            activeAccount: account,
            accounts: updatedAccounts,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Login failed",
          });
          throw err;
        }
      },

      register: async (username, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await apiClient.register(username, email, password);
          const token = data.access_token;

          const serverUrl = apiClient.getServerUrl() || "local";

          const account: Account = {
            id: `${username}@${serverUrl}`,
            username,
            email,
            serverUrl,
            token,
          };

          const { accounts } = get();
          const updatedAccounts = [
            ...accounts.filter((a) => a.id !== account.id),
            account,
          ];

          set({
            user: { id: "new", username, email },
            activeAccount: account,
            accounts: updatedAccounts,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Registration failed",
          });
          throw err;
        }
      },

      logout: async () => {
        try {
          await apiClient.logout();
        } catch {
          // Server logout failed — still clear local state
        }

        const { accounts, activeAccount } = get();
        const remaining = accounts.filter(
          (a) => a.id !== activeAccount?.id
        );

        if (remaining.length > 0) {
          // Switch to next account
          const next = remaining[0];
          apiClient.setToken(next.token);
          apiClient.setServerUrl(next.serverUrl);
          set({
            activeAccount: next,
            accounts: remaining,
            user: { id: "cached", username: next.username, email: next.email },
          });
        } else {
          set({
            user: null,
            activeAccount: null,
            accounts: [],
          });
          apiClient.setToken(null);
          apiClient.setServerUrl(null);
        }
      },

      logoutAll: async () => {
        const { accounts } = get();
        for (const account of accounts) {
          try {
            apiClient.setToken(account.token);
            await apiClient.logout();
          } catch {
            // Best-effort
          }
        }
        set({
          user: null,
          activeAccount: null,
          accounts: [],
        });
        apiClient.setToken(null);
        apiClient.setServerUrl(null);
      },

      fetchProfile: async () => {
        try {
          const profile = await apiClient.getProfile();
          set({ user: profile });
        } catch {
          // Profile fetch failed — keep existing user data
        }
      },

      switchAccount: (account) => {
        apiClient.setToken(account.token);
        apiClient.setServerUrl(account.serverUrl);
        set({
          activeAccount: account,
          user: {
            id: "cached",
            username: account.username,
            email: account.email,
          },
        });
      },

      removeAccount: (accountId) => {
        const { accounts, activeAccount } = get();
        const remaining = accounts.filter((a) => a.id !== accountId);

        if (activeAccount?.id === accountId) {
          if (remaining.length > 0) {
            const next = remaining[0];
            apiClient.setToken(next.token);
            apiClient.setServerUrl(next.serverUrl);
            set({
              accounts: remaining,
              activeAccount: next,
              user: {
                id: "cached",
                username: next.username,
                email: next.email,
              },
            });
          } else {
            set({
              accounts: [],
              activeAccount: null,
              user: null,
            });
            apiClient.setToken(null);
            apiClient.setServerUrl(null);
          }
        } else {
          set({ accounts: remaining });
        }
      },

      setError: (error) => set({ error }),

      clearAuth: () => {
        apiClient.setToken(null);
        apiClient.setServerUrl(null);
        set({
          user: null,
          activeAccount: null,
          accounts: [],
          error: null,
        });
      },

      hydrateFromStorage: () => {
        const { activeAccount } = get();
        if (activeAccount?.token) {
          apiClient.setToken(activeAccount.token);
          apiClient.setServerUrl(activeAccount.serverUrl);
        }
      },
    }),
    {
      name: "sphere-auth",
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccount: state.activeAccount,
        user: state.user,
      }),
      onRehydrateStorage: () => (state, error) => {
        // Restore API client token + server URL from persisted state
        if (state?.activeAccount) {
          if (state.activeAccount.token) {
            apiClient.setToken(state.activeAccount.token);
          }
          if (state.activeAccount.serverUrl) {
            apiClient.setServerUrl(state.activeAccount.serverUrl);
          }
        }
        // Signal that hydration is complete — safe to make routing decisions.
        // queueMicrotask defers until after useAuthStore is fully assigned,
        // avoiding a TDZ ReferenceError during the create() call.
        // We set it regardless of errors so the UI never stays frozen.
        queueMicrotask(() => {
          useAuthStore.setState({ _hasHydrated: true });
        });
        void error; // suppress unused-var lint
      },
    }
  )
);
