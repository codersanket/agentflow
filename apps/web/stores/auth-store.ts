import { create } from "zustand";
import { api, setAccessToken, getAccessToken, type SignupInput } from "@/lib/api";

function setAuthCookie() {
  document.cookie = "agentflow_auth=1; path=/; max-age=604800; samesite=lax";
}

function clearAuthCookie() {
  document.cookie = "agentflow_auth=; path=/; max-age=0";
}

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupInput) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const res = await api.auth.login(email, password);
    setAccessToken(res.access_token);
    setAuthCookie();
    set({
      accessToken: res.access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  signup: async (data) => {
    const res = await api.auth.signup(data);
    setAccessToken(res.access_token);
    setAuthCookie();
    set({
      accessToken: res.access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    setAccessToken(null);
    clearAuthCookie();
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  refreshToken: async () => {
    const token = await api.auth.refresh();
    if (token) {
      set({ accessToken: token });
      return true;
    }
    get().logout();
    return false;
  },

  loadUser: async () => {
    // If we already have a token (from login/signup), use it directly
    const currentToken = getAccessToken();
    if (currentToken) {
      try {
        const user = await api.auth.me();
        set({
          user,
          accessToken: currentToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        set({ isLoading: false, isAuthenticated: false });
      }
      return;
    }

    // Otherwise try to refresh from cookie
    try {
      const token = await api.auth.refresh();
      if (!token) {
        set({ isLoading: false });
        return;
      }
      setAccessToken(token);
      const user = await api.auth.me();
      set({
        user,
        accessToken: token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false, isAuthenticated: false });
    }
  },
}));
