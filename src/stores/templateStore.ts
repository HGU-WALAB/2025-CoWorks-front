import { create } from 'zustand';
import axios from 'axios';
import { Template, TemplateCreateRequest } from '../types/template';

interface TemplateStore {
  templates: Template[];
  currentTemplate: Template | null;
  loading: boolean;
  error: string | null;

  // Actions
  getTemplates: () => Promise<void>;
  getTemplate: (id: number) => Promise<void>;
  updateTemplate: (id: number, data: TemplateCreateRequest) => Promise<void>;
  deleteTemplate: (id: number) => Promise<void>;
  clearError: () => void;
}

import { API_BASE_URL } from '../config/api';

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  currentTemplate: null,
  loading: false,
  error: null,
  
  getTemplates: async () => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_BASE_URL}/templates`);
      set({ templates: response.data, loading: false });
    } catch (error) {
      set({ error: '템플릿 목록을 불러오는데 실패했습니다.', loading: false });
    }
  },

  getTemplate: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_BASE_URL}/templates/${id}`);
      set({ currentTemplate: response.data, loading: false });
    } catch (error) {
      set({ error: '템플릿을 불러오는데 실패했습니다.', loading: false });
    }
  },

  updateTemplate: async (id: number, data: TemplateCreateRequest) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.put(`${API_BASE_URL}/templates/${id}`, data);
      
      // 현재 템플릿 업데이트
      set({ currentTemplate: response.data });
      
      // 템플릿 목록에서도 업데이트
      const templates = get().templates.map(template => 
        template.id === id ? response.data : template
      );
      set({ templates, loading: false });
    } catch (error) {
      set({ error: '템플릿 업데이트에 실패했습니다.', loading: false });
      throw error;
    }
  },

  deleteTemplate: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await axios.delete(`${API_BASE_URL}/templates/${id}`);
      
      // 템플릿 목록에서 제거
      const templates = get().templates.filter(template => template.id !== id);
      set({ templates, loading: false });
    } catch (error) {
      set({ error: '템플릿 삭제에 실패했습니다.', loading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
})); 