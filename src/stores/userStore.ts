import { create } from 'zustand';
import axios from 'axios';

export interface User {
  id: string;
  email: string;
  name: string;
  position: string;
}

interface UserStore {
  users: User[];
  loading: boolean;
  error: string | null;

  // Actions
  searchUsers: (query: string) => Promise<User[]>;
  clearUsers: () => void;
  clearError: () => void;
}

const API_BASE_URL = 'http://localhost:8080/api';

export const useUserStore = create<UserStore>((set, get) => ({
  users: [],
  loading: false,
  error: null,

  searchUsers: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_BASE_URL}/users/search`, {
        params: { query }
      });
      const users = response.data;
      set({ users, loading: false });
      return users;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.error || '사용자 검색에 실패했습니다.', 
        loading: false,
        users: []
      });
      return [];
    }
  },

  clearUsers: () => {
    set({ users: [] });
  },

  clearError: () => {
    set({ error: null });
  },
})); 