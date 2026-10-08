"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, useCallback } from "react";

export type UserTier = "free" | "premium";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  mode: string;
  createdAt: number;
};

export type PortfolioSnapshot = {
  holdings: { asset: string; quantity: number; supported: boolean }[];
  insights: {
    asset: string;
    quantity: number;
    forecastedChange?: number;
    signal: string;
    insight: string;
  }[];
  analyzedAt: number;
};

export type User = {
  id: string;
  name: string;
  email: string;
  avatar: string;
  tier: UserTier;
  chatCount: number;
  chatSessions: ChatSession[];
  binanceApiKey: string;
  binanceConnected: boolean;
  portfolioSnapshot: PortfolioSnapshot | null;
  portfolioUsed: boolean; // free users get one analysis
  createdAt: number;
};

const FREE_CHAT_LIMIT = 50;
const PREMIUM_PRICE = "$99.99/month";
const USERS_STORAGE_KEY = "intellitrex-users";
const CURRENT_USER_KEY = "intellitrex-current-user";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "myintellitrex2026";

type AuthContextType = {
  user: User | null;
  isLoggedIn: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  chatCount: number;
  chatLimit: number;
  canChat: boolean;
  premiumPrice: string;
  signInWithGoogle: () => void;
  signInWithEmail: (name: string, email: string) => boolean;
  signInAdmin: (username: string, password: string) => boolean;
  signOut: () => void;
  incrementChatCount: () => void;
  saveChatSession: (session: ChatSession) => void;
  loadChatSession: (sessionId: string) => ChatSession | null;
  getChatSessions: () => ChatSession[];
  upgradeToPremium: () => void;
  setBinanceConnected: (connected: boolean, apiKey?: string) => void;
  unlinkBinance: () => void;
  savePortfolioSnapshot: (snapshot: PortfolioSnapshot) => void;
  deleteAccount: () => void;
  getAllUsers: () => User[];
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isPremium: false,
  isAdmin: false,
  chatCount: 0,
  chatLimit: FREE_CHAT_LIMIT,
  canChat: true,
  premiumPrice: PREMIUM_PRICE,
  signInWithGoogle: () => {},
  signInWithEmail: () => false,
  signInAdmin: () => false,
  signOut: () => {},
  incrementChatCount: () => {},
  saveChatSession: () => {},
  loadChatSession: () => null,
  getChatSessions: () => [],
  upgradeToPremium: () => {},
  setBinanceConnected: () => {},
  unlinkBinance: () => {},
  savePortfolioSnapshot: () => {},
  deleteAccount: () => {},
  getAllUsers: () => [],
});

export function useAuth() {
  return useContext(AuthContext);
}

function getAllUsersFromStorage(): User[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAllUsers(users: User[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  notifyAuthChange();
}

function getCurrentUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(CURRENT_USER_KEY);
}

function setCurrentUserId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(CURRENT_USER_KEY, id);
  else localStorage.removeItem(CURRENT_USER_KEY);
  notifyAuthChange();
}

function upsertUser(user: User) {
  const users = getAllUsersFromStorage();
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx >= 0) users[idx] = user;
  else users.push(user);
  saveAllUsers(users);
}

function createUser(name: string, email: string, provider: string): User {
  return {
    id: `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    email,
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4a6cf7&color=fff`,
    tier: "free",
    chatCount: 0,
    chatSessions: [],
    binanceApiKey: "",
    binanceConnected: false,
    portfolioSnapshot: null,
    portfolioUsed: false,
    createdAt: Date.now(),
  };
}

function notifyAuthChange() {
  window.dispatchEvent(new Event("intellitrex-auth-change"));
}

function subscribeToAuth(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("intellitrex-auth-change", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("intellitrex-auth-change", onChange);
  };
}

function getAuthSnapshot() {
  const userId = getCurrentUserId();
  return JSON.stringify({
    user: getAllUsersFromStorage().find((storedUser) => storedUser.id === userId) ?? null,
    isAdmin: sessionStorage.getItem("intellitrex-admin") === "true",
  });
}

const SERVER_AUTH_SNAPSHOT = JSON.stringify({ user: null, isAdmin: false });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeToAuth, getAuthSnapshot, () => SERVER_AUTH_SNAPSHOT);
  const { user, isAdmin } = useMemo(
    () => JSON.parse(snapshot) as { user: User | null; isAdmin: boolean },
    [snapshot]
  );

  const persistUser = useCallback((updated: User) => {
    upsertUser(updated);
    setCurrentUserId(updated.id);
  }, []);

  const updateUser = useCallback(
    (updater: (prev: User) => User) => {
      const currentUser = getAllUsersFromStorage().find((storedUser) => storedUser.id === getCurrentUserId());
      if (currentUser) upsertUser(updater(currentUser));
    },
    []
  );

  const signInWithGoogle = useCallback(() => {
    // In production: use NextAuth.js Google provider
    // For now: open a clean sign-in modal (handled by the profile page)
  }, []);

  const signInWithEmail = useCallback(
    (name: string, email: string): boolean => {
      if (!name || !email) return false;

      // Check if returning user
      const users = getAllUsersFromStorage();
      const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        setCurrentUserId(existing.id);
        return true;
      }

      const newUser = createUser(name, email, "google");
      persistUser(newUser);
      return true;
    },
    [persistUser]
  );

  const signInAdmin = useCallback((username: string, password: string): boolean => {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      sessionStorage.setItem("intellitrex-admin", "true");
      notifyAuthChange();
      return true;
    }
    return false;
  }, []);

  const signOut = useCallback(() => {
    setCurrentUserId(null);
    sessionStorage.removeItem("intellitrex-admin");
    notifyAuthChange();
  }, []);

  const incrementChatCount = useCallback(() => {
    updateUser((prev) => ({ ...prev, chatCount: prev.chatCount + 1 }));
  }, [updateUser]);

  const saveChatSession = useCallback(
    (session: ChatSession) => {
      updateUser((prev) => {
        const sessions = [...prev.chatSessions];
        const idx = sessions.findIndex((s) => s.id === session.id);
        if (idx >= 0) sessions[idx] = session;
        else sessions.unshift(session);
        return { ...prev, chatSessions: sessions.slice(0, 100) };
      });
    },
    [updateUser]
  );

  const loadChatSession = useCallback(
    (sessionId: string): ChatSession | null => {
      return user?.chatSessions.find((s) => s.id === sessionId) || null;
    },
    [user]
  );

  const getChatSessions = useCallback(() => {
    return user?.chatSessions || [];
  }, [user]);

  const upgradeToPremium = useCallback(() => {
    updateUser((prev) => ({ ...prev, tier: "premium" }));
  }, [updateUser]);

  const setBinanceConnected = useCallback(
    (connected: boolean, apiKey?: string) => {
      updateUser((prev) => ({
        ...prev,
        binanceConnected: connected,
        binanceApiKey: apiKey || prev.binanceApiKey,
      }));
    },
    [updateUser]
  );

  const unlinkBinance = useCallback(() => {
    updateUser((prev) => ({
      ...prev,
      binanceConnected: false,
      binanceApiKey: "",
      portfolioSnapshot: null,
    }));
  }, [updateUser]);

  const savePortfolioSnapshot = useCallback(
    (snapshot: PortfolioSnapshot) => {
      updateUser((prev) => ({
        ...prev,
        portfolioSnapshot: snapshot,
        portfolioUsed: true,
      }));
    },
    [updateUser]
  );

  const deleteAccount = useCallback(() => {
    if (!user) return;
    const users = getAllUsersFromStorage().filter((u) => u.id !== user.id);
    saveAllUsers(users);
    setCurrentUserId(null);
  }, [user]);

  const getAllUsers = useCallback(() => {
    return getAllUsersFromStorage();
  }, []);

  const isPremium = user?.tier === "premium";
  const canChat = isPremium || (user?.chatCount ?? 0) < FREE_CHAT_LIMIT;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isPremium,
        isAdmin,
        chatCount: user?.chatCount ?? 0,
        chatLimit: FREE_CHAT_LIMIT,
        canChat,
        premiumPrice: PREMIUM_PRICE,
        signInWithGoogle,
        signInWithEmail,
        signInAdmin,
        signOut,
        incrementChatCount,
        saveChatSession,
        loadChatSession,
        getChatSessions,
        upgradeToPremium,
        setBinanceConnected,
        unlinkBinance,
        savePortfolioSnapshot,
        deleteAccount,
        getAllUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
