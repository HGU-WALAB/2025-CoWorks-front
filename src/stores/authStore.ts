import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  position: string;
}

export interface AuthResponse {
  id: string;
  email: string;
  name: string;
  position: string;
  role: string;
  token: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  position: string;
  role: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Actions
  initialize: () => void;
  signup: (request: SignupRequest) => Promise<void>;
  login: (request: LoginRequest) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setAuthHeader: () => void;
}

const API_BASE_URL = 'http://localhost:8080/api';

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

      signup: async (request: SignupRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/signup`, request);
          const authData: AuthResponse = response.data;
          
          set({
            user: {
              id: authData.id,
              email: authData.email,
              name: authData.name,
              position: authData.position,
              role: authData.role,
            },
            token: authData.token,
            isAuthenticated: true,
            loading: false,
          });
          
          get().setAuthHeader();
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || '회원가입에 실패했습니다.', 
            loading: false 
          });
          throw error;
        }
      },

      login: async (request: LoginRequest) => {
        set({ loading: true, error: null });
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/login`, request);
          const authData: AuthResponse = response.data;
          
          set({
            user: {
              id: authData.id,
              email: authData.email,
              name: authData.name,
              position: authData.position,
              role: authData.role,
            },
            token: authData.token,
            isAuthenticated: true,
            loading: false,
          });
          
          get().setAuthHeader();
        } catch (error: any) {
          set({ 
            error: error.response?.data?.error || '로그인에 실패했습니다.', 
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