import { create } from 'zustand';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface ReviewRequest {
  signatureText?: string;
  signatureImageUrl?: string;
  rejectionReason?: string;
}

interface ReviewStore {
  loading: boolean;
  error: string | null;
  
  // Actions
  approveDocument: (documentId: number, review: ReviewRequest) => Promise<any>;
  rejectDocument: (documentId: number, review: ReviewRequest) => Promise<any>;
  canReview: (documentId: number) => Promise<boolean>;
  clearError: () => void;
}

export const useReviewStore = create<ReviewStore>((set, get) => ({
  loading: false,
  error: null,

  approveDocument: async (documentId: number, review: ReviewRequest) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${documentId}/approve`, review);
      set({ loading: false });
      return response.data;
    } catch (error) {
      set({ error: '문서 승인에 실패했습니다.', loading: false });
      throw error;
    }
  },

  rejectDocument: async (documentId: number, review: ReviewRequest) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${documentId}/reject`, review);
      set({ loading: false });
      return response.data;
    } catch (error) {
      set({ error: '문서 반려에 실패했습니다.', loading: false });
      throw error;
    }
  },

  canReview: async (documentId: number) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/${documentId}/can-review`);
      return response.data;
    } catch (error) {
      return false;
    }
  },

  clearError: () => {
    set({ error: null });
  },
})); 