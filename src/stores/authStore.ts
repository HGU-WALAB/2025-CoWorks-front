import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';
import { LoginRequest, SignupRequest, AuthResponse, HisnetAuthResponse, User } from '../types/auth';

// Re-export types for other components
export type { LoginRequest, SignupRequest, AuthResponse, HisnetAuthResponse, User };

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => void;
  refreshUser: () => Promise<void>;
  signup: (request: SignupRequest) => Promise<void>;
  login: (request: LoginRequest) => Promise<void>;
  hisnetLogin: (hisnetToken: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuthHeader: () => void;
}

import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

// axios 인터셉터 추가 (디버깅용)
axios.interceptors.request.use(
  (config) => {
    console.log('Axios request:', {
      url: config.url,
      method: config.method,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      // 초기화 함수 추가
      initialize: () => {
        const { token } = get();
        if (token) {
          // 저장된 토큰이 있으면 Authorization 헤더 설정
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('Auth initialized with token:', token);
        }
      },

      refreshUser: async () => {
        try {
          const { token } = get();
          if (token && !axios.defaults.headers.common['Authorization']) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          }
          const res = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.AUTH.ME}`, {
            headers: axios.defaults.headers.common['Authorization']
              ? undefined
              : token
              ? { Authorization: `Bearer ${token}` }
              : undefined,
          });
          const data = res.data as Partial<User> & { hasFolderAccess?: boolean };
          set((state) => ({
            user: state.user ? { ...state.user, ...data } : (data as User),
          }));
        } catch {
          // ignore
        }
      },

      signup: async (request: SignupRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.SIGNUP}`, request);
          const authData: AuthResponse = response.data;
          
          set({
            user: {
              id: authData.id,
              email: authData.email,
              name: authData.name,
              position: authData.position,
              role: authData.role,
              hasFolderAccess: authData.hasFolderAccess,
            },
            token: authData.token,
            isAuthenticated: true,
            loading: false,
          });
          
          get().setAuthHeader();
        } catch (error: unknown) {
          const errorMessage = error instanceof Error && 'response' in error && error.response && 
            typeof error.response === 'object' && 'data' in error.response && 
            error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data
            ? (error.response.data as { error: string }).error
            : '회원가입에 실패했습니다.';
          
          set({ 
            error: errorMessage, 
            loading: false 
          });
          throw error;
        }
      },

      login: async (request: LoginRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, request);
          const authData: AuthResponse = response.data;
          
          set({
            user: {
              id: authData.id,
              email: authData.email,
              name: authData.name,
              position: authData.position,
              role: authData.role,
              hasFolderAccess: authData.hasFolderAccess,
            },
            token: authData.token,
            isAuthenticated: true,
            loading: false,
          });
          
          get().setAuthHeader();
        } catch (error: unknown) {
          const errorMessage = error instanceof Error && 'response' in error && error.response && 
            typeof error.response === 'object' && 'data' in error.response && 
            error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data
            ? (error.response.data as { error: string }).error
            : '로그인에 실패했습니다.';
          
          set({ 
            error: errorMessage, 
            loading: false 
          });
          throw error;
        }
      },

      hisnetLogin: async (hisnetToken: string) => {
        set({ loading: true, error: null });
        try {
          console.log("Hisnet Token : ", hisnetToken);
          console.log("API URL : ", `${API_BASE_URL}${API_ENDPOINTS.AUTH.HISNET_LOGIN}`);
          
          const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.AUTH.HISNET_LOGIN}`, {
            hisnetToken: hisnetToken
          });
          
          console.log("Full response:", response);
          console.log("Response status:", response.status);
          console.log("Response data:", response.data);
          
          const authData: HisnetAuthResponse = response.data;
          console.log("Auth response:", authData);
          
          set({
            user: {
              id: authData.userId,
              email: '', // 히즈넷 응답에는 이메일이 없으므로 빈 문자열
              name: authData.userName,
              position: authData.department,
              role: 'USER', // 기본값으로 설정
            },
            token: authData.token,
            isAuthenticated: true,
            loading: false,
          });
          
          get().setAuthHeader();
          console.log("Login successful, redirecting...");
        } catch (error: unknown) {
          console.log("토큰 보내기 실패");
          console.error("Full error object:", error);
          
          if (error && typeof error === 'object' && 'response' in error) {
            const axiosError = error as { response?: { status?: number; data?: unknown; statusText?: string } };
            console.error("Error response status:", axiosError.response?.status);
            console.error("Error response data:", axiosError.response?.data);
            console.error("Error response statusText:", axiosError.response?.statusText);
          }
          
          const errorMessage = error instanceof Error && 'response' in error && error.response && 
            typeof error.response === 'object' && 'data' in error.response && 
            error.response.data && typeof error.response.data === 'object' && 'error' in error.response.data
            ? (error.response.data as { error: string }).error
            : '히즈넷 로그인에 실패했습니다.';
          
          set({ 
            error: errorMessage, 
            loading: false 
          });
          throw error;
        }
      },

      logout: () => {
        // axios 헤더에서 토큰 제거
        delete axios.defaults.headers.common['Authorization'];
        
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      setAuthHeader: () => {
        const { token } = get();
        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('Auth header set:', `Bearer ${token}`);
        } else {
          console.log('No token available for auth header');
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 