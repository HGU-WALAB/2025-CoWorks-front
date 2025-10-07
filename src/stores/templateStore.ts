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
  duplicateTemplate: (id: number, newName: string, description?: string, folderId?: string | null) => Promise<Template>;
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
      // 최신 템플릿이 맨 앞에 오도록 역순으로 정렬
      const templates = [...response.data].reverse();
      set({ templates, loading: false });
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
      
      // 수정된 템플릿을 맨 앞으로 이동
      const templates = [
        response.data,
        ...get().templates.filter(template => template.id !== id)
      ];
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
      // 삭제 실패 시 error 상태를 설정하지 않고 바로 예외를 던짐
      set({ loading: false });
      throw error;
    }
  },

  duplicateTemplate: async (id: number, newName: string, description?: string, folderId?: string | null) => {
    set({ loading: true, error: null });
    try {
      const requestData: any = {
        name: newName
      };
      
      if (description !== undefined) {
        requestData.description = description;
      }
      
      if (folderId !== undefined) {
        requestData.folderId = folderId;
      }
      
      const response = await axios.post(`${API_BASE_URL}/templates/${id}/duplicate`, requestData);
      
      // 새로 생성된 템플릿을 목록에 추가
      const templates = [response.data, ...get().templates];
      set({ templates, loading: false });
      
      return response.data;
    } catch (error) {
      set({ error: '템플릿 복제에 실패했습니다.', loading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
})); 