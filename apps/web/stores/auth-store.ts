import { create } from "zustand";
import { api, setAccessToken, type SignupInput } from "@/lib/api";

interface User {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  role: string;
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
    set({
      user: res.user,
      accessToken: res.access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  signup: async (data) => {
    const res = await api.auth.signup(data);
    setAccessToken(res.access_token);
    set({
      user: res.user,
      accessToken: res.access_token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    setAccessToken(null);
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
    try {
      const token = await api.auth.refresh();
      if (!token) {
        set({ isLoading: false });
        return;
      }
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
