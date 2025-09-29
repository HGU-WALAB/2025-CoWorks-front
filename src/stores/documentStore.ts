import { create } from 'zustand';
import axios from 'axios';
import { 
  Document, 
  DocumentData, 
  DocumentCreateRequest, 
  DocumentUpdateRequest,
  TaskInfo,
  TemplateInfo,
  DocumentStatusLog
} from '../types/document';

// Re-export types for other components
export type { Document, DocumentData, TaskInfo, TemplateInfo, DocumentStatusLog };

interface DocumentStore {
  documents: Document[];
  todoDocuments: Document[];
  currentDocument: Document | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchDocuments: () => Promise<void>;
  fetchTodoDocuments: () => Promise<void>;
  createDocument: (request: DocumentCreateRequest) => Promise<Document>;
  getDocument: (id: number) => Promise<Document>;
  markAsViewed: (id: number) => Promise<void>;
  updateDocument: (id: number, request: DocumentUpdateRequest) => Promise<Document>;
  updateDocumentSilently: (id: number, request: DocumentUpdateRequest) => Promise<boolean>; // 자동 저장용 - 성공 여부 반환
  deleteDocument: (id: number) => Promise<void>;
  submitForReview: (id: number) => Promise<Document>;
  assignEditor: (id: number, editorEmail: string) => Promise<Document>;
  assignReviewer: (id: number, reviewerEmail: string) => Promise<Document>;
  downloadPdf: (id: number) => Promise<void>;
  setCurrentDocument: (document: Document | null) => void;
  clearCurrentDocument: () => void;
  clearError: () => void;
}

import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  documents: [],
  todoDocuments: [],
  currentDocument: null,
  loading: false,
  error: null,

  fetchDocuments: async () => {
    set({ loading: true, error: null });
    try {
      console.log('DocumentStore: Fetching documents...');
      console.log('DocumentStore: Current axios headers:', axios.defaults.headers.common);
      
      const response = await axios.get(`${API_BASE_URL}/documents`);
      console.log('DocumentStore: Documents fetched successfully:', response.data);
      set({ documents: response.data, loading: false });
    } catch (error: unknown) {
      console.error('DocumentStore: Error fetching documents:', error);
      const axiosError = error as { response?: { data?: unknown } };
      console.error('DocumentStore: Error response:', axiosError.response?.data);
      set({ error: '문서를 불러오는데 실패했습니다.', loading: false });
    }
  },

  fetchTodoDocuments: async () => {
    try {
      console.log('DocumentStore: Fetching todo documents...');
      const response = await axios.get(`${API_BASE_URL}/documents/todo`);
      console.log('DocumentStore: Todo documents fetched successfully:', response.data);
      set({ todoDocuments: response.data });
    } catch (error: unknown) {
      console.error('DocumentStore: Error fetching todo documents:', error);
      const axiosError = error as { response?: { data?: unknown } };
      console.error('DocumentStore: Error response:', axiosError.response?.data);
      set({ error: '할 일 문서를 불러오는데 실패했습니다.' });
    }
  },

  createDocument: async (request: DocumentCreateRequest) => {
    set({ loading: true, error: null });
    try {
      console.log('DocumentStore: Creating document with headers:', axios.defaults.headers.common);
      const response = await axios.post(`${API_BASE_URL}/documents`, request);
      const newDocument = response.data;
      set((state) => ({
        documents: [newDocument, ...state.documents],
        loading: false,
      }));
      // 문서 생성 이벤트 발생
      console.log('DocumentStore: Document created, dispatching event');
      window.dispatchEvent(new CustomEvent('documentCreated', {
        detail: { document: newDocument }
      }));
      return newDocument;
    } catch (error) {
      console.error('DocumentStore: Create document error:', error);
      set({ error: '문서 생성에 실패했습니다.', loading: false });
      throw error;
    }
  },

  getDocument: async (id: number): Promise<Document> => {
    set({ loading: true, error: null });
    try {
      console.log('📄 DocumentStore: 문서 로드 시작:', id);
      
      // 이전 문서 상태 완전히 초기화
      set({ currentDocument: null });
      
      const response = await axios.get(`${API_BASE_URL}/documents/${id}`);
      const document = response.data;
      
      console.log('📄 DocumentStore: 문서 로드 완료:', {
        documentId: document.id,
        templateId: document.templateId,
        hasData: !!document.data
      });
      
      set({ currentDocument: document, loading: false });
      
      // 문서 조회 시 자동으로 markAsViewed 호출
      try {
        await get().markAsViewed(id);
        console.log('📅 DocumentStore: 문서 조회 표시 성공:', id);
        
        // 조회 표시 후 현재 문서의 tasks 정보 업데이트 (NEW 태그 즉시 제거를 위해)
        set((state) => {
          if (state.currentDocument && state.currentDocument.id === id) {
            const updatedDocument = {
              ...state.currentDocument,
              tasks: state.currentDocument.tasks?.map(task => ({
                ...task,
                isNew: false // 조회했으므로 더 이상 새로운 할당이 아님
              }))
            };
            return { ...state, currentDocument: updatedDocument };
          }
          return state;
        });
        
      } catch (viewError) {
        console.warn('📅 DocumentStore: 문서 조회 표시 실패 (무시):', viewError);
        // 조회 표시 실패는 무시하고 계속 진행
      }
      
      return document;
    } catch (error) {
      console.error('📄 DocumentStore: 문서 로드 실패:', { id, error });
      set({ error: '문서를 불러오는데 실패했습니다.', loading: false, currentDocument: null });
      throw error;
    }
  },

  markAsViewed: async (id: number) => {
    try {
      await axios.post(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.MARK_AS_VIEWED(id)}`);
      console.log('📅 DocumentStore: 문서 조회 표시 성공:', id);
    } catch (error) {
      console.error('DocumentStore: Mark as viewed error:', error);
      throw error;
    }
  },

  updateDocument: async (id: number, request: DocumentUpdateRequest) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.put(`${API_BASE_URL}/documents/${id}`, request);
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error: unknown) {
      console.error('DocumentStore: Update error:', error);
      const axiosError = error as { response?: { data?: unknown } };
      console.error('DocumentStore: Update response:', axiosError.response?.data);
      set({ error: '문서 수정에 실패했습니다.', loading: false });
      throw error;
    }
  },

  updateDocumentSilently: async (id: number, request: DocumentUpdateRequest) => {
    // 자동 저장용 - loading과 currentDocument 상태를 변경하지 않음
    try {
      await axios.put(`${API_BASE_URL}/documents/${id}`, request);
      return true; // 성공
    } catch (error: unknown) {
      console.error('DocumentStore: Silent update error:', error);
      return false; // 실패
    }
  },

  submitForReview: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${id}/submit-for-review`);
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error: unknown) {
      console.error('DocumentStore: Submit for review error:', error);
      const axiosError = error as { response?: { data?: unknown } };
      console.error('DocumentStore: Submit for review response:', axiosError.response?.data);
      set({ error: '검토 요청에 실패했습니다.', loading: false });
      throw error;
    }
  },

  assignEditor: async (id: number, editorEmail: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${id}/assign-editor`, {
        editorEmail
      });
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error) {
      set({ error: '편집자 할당에 실패했습니다.', loading: false });
      throw error;
    }
  },

  assignReviewer: async (id: number, reviewerEmail: string) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.post(`${API_BASE_URL}/documents/${id}/assign-reviewer`, {
        reviewerEmail
      });
      const updatedDocument = response.data;
      
      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? updatedDocument : doc
        ),
        currentDocument: state.currentDocument?.id === id ? updatedDocument : state.currentDocument,
        loading: false,
      }));
      
      return updatedDocument;
    } catch (error) {
      set({ error: '검토자 할당에 실패했습니다.', loading: false });
      throw error;
    }
  },

  downloadPdf: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/${id}/download-pdf`, {
        responseType: 'blob'
      });
      
      // PDF 파일 다운로드
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `document_${id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      set({ loading: false });
    } catch (error: unknown) {
      console.error('DocumentStore: Download PDF error:', error);
      const axiosError = error as { response?: { data?: unknown } };
      console.error('DocumentStore: Download PDF response:', axiosError.response?.data);
      set({ error: 'PDF 다운로드에 실패했습니다.', loading: false });
      throw error;
    }
  },

  setCurrentDocument: (document: Document | null) => {
    set({ currentDocument: document });
  },

  clearCurrentDocument: () => {
    console.log('🧹 DocumentStore: currentDocument 상태 초기화');
    set({ currentDocument: null, error: null });
  },

  deleteDocument: async (id: number) => {
    set({ loading: true, error: null });
    try {
      console.log('🗑️ DocumentStore: 문서 삭제 시도:', id);
      await axios.delete(`${API_BASE_URL}/documents/${id}`);
      
      set((state) => ({
        documents: state.documents.filter((doc) => doc.id !== id),
        currentDocument: state.currentDocument?.id === id ? null : state.currentDocument,
        loading: false,
      }));
      
      console.log('✅ DocumentStore: 문서 삭제 완료:', id);
    } catch (error: unknown) {
      console.error('DocumentStore: Delete error:', error);
      set({ error: '문서 삭제에 실패했습니다.', loading: false });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
})); 