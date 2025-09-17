import { create } from 'zustand';
import { FolderState } from '../types/folder';
import folderService from '../services/folderService';
import { useAuthStore } from './authStore';

export const useFolderStore = create<FolderState>((set, get) => ({
  // 데이터
  folders: [],
  documents: [],
  currentFolder: null,
  folderPath: [],
  
  // UI 상태
  loading: false,
  error: null,
  
  // 액션
  loadFolderContents: async (folderId: string | null) => {
    set({ loading: true, error: null });
    try {
      if (folderId === null) {
        // 루트 폴더 목록 + 미분류 문서 조회
        const [folders, documents] = await Promise.all([
          folderService.getRootFolders(),
          folderService.getUnclassifiedDocuments()
        ]);
        
        set({
          folders,
          documents,
          currentFolder: null,
          folderPath: [],
          loading: false
        });
      } else {
        // 특정 폴더의 내용 + 폴더 정보 + 폴더 경로 조회
        const [folderContents, currentFolder, folderPath] = await Promise.all([
          folderService.getFolderContents(folderId),
          folderService.getFolder(folderId),
          folderService.getFolderPath(folderId)
        ]);
        
        set({
          folders: folderContents.folders,
          documents: folderContents.documents,
          currentFolder,
          folderPath,
          loading: false
        });
      }
    } catch (error: any) {
      console.error('Error loading folder contents:', error);
      set({
        error: error.message || '폴더 내용을 불러오는데 실패했습니다.',
        loading: false
      });
    }
  },

  createFolder: async (name: string, parentId: string | null) => {
    set({ loading: true, error: null });
    try {
      const newFolder = await folderService.createFolder({ name, parentId });
      
      // 현재 폴더 목록에 새 폴더 추가
      const { folders } = get();
      set({
        folders: [...folders, newFolder],
        loading: false
      });
      
      console.log('Folder created successfully:', newFolder);
    } catch (error: any) {
      console.error('Error creating folder:', error);
      set({
        error: error.message || '폴더 생성에 실패했습니다.',
        loading: false
      });
      throw error; // 컴포넌트에서 에러 처리할 수 있도록 재던지기
    }
  },

  updateFolder: async (id: string, name: string) => {
    set({ loading: true, error: null });
    try {
      const updatedFolder = await folderService.updateFolder(id, { name });
      
      // 현재 폴더 목록에서 업데이트
      const { folders, currentFolder, folderPath } = get();
      
      set({
        folders: folders.map(folder => 
          folder.id === id ? updatedFolder : folder
        ),
        currentFolder: currentFolder?.id === id ? updatedFolder : currentFolder,
        folderPath: folderPath.map(folder =>
          folder.id === id ? updatedFolder : folder
        ),
        loading: false
      });
      
      console.log('Folder updated successfully:', updatedFolder);
    } catch (error: any) {
      console.error('Error updating folder:', error);
      set({
        error: error.message || '폴더 수정에 실패했습니다.',
        loading: false
      });
      throw error;
    }
  },

  renameFolder: async (id: string, newName: string) => {
    return get().updateFolder(id, newName);
  },

  moveFolder: async (id: string, targetParentId: string | null) => {
    set({ loading: true, error: null });
    try {
      // 인증 헤더 재설정
      const { setAuthHeader } = useAuthStore.getState();
      setAuthHeader();
      
      const movedFolder = await folderService.moveFolder(id, targetParentId);
      
      // 현재 폴더 목록에서 이동된 폴더 제거
      const { folders } = get();
      set({
        folders: folders.filter(folder => folder.id !== id),
        loading: false
      });
      
      console.log('Folder moved successfully:', movedFolder);
    } catch (error: any) {
      console.error('Error moving folder:', error);
      set({
        error: error.message || '폴더 이동에 실패했습니다.',
        loading: false
      });
      throw error;
    }
  },

  deleteFolder: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await folderService.deleteFolder(id);
      
      // 현재 폴더 목록에서 제거
      const { folders } = get();
      set({
        folders: folders.filter(folder => folder.id !== id),
        loading: false
      });
      
      console.log('Folder deleted successfully:', id);
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      set({
        error: error.message || '폴더 삭제에 실패했습니다.',
        loading: false
      });
      throw error;
    }
  },

  moveDocument: async (documentId: string, targetFolderId: string | null) => {
    set({ loading: true, error: null });
    try {
      await folderService.moveDocumentToFolder(documentId, targetFolderId);
      
      // 문서 목록에서 이동된 문서 제거 (현재 폴더에서)
      const { documents } = get();
      set({
        documents: documents.filter(doc => doc.id.toString() !== documentId),
        loading: false
      });
      
      console.log('Document moved successfully:', { documentId, targetFolderId });
    } catch (error: any) {
      console.error('Error moving document:', error);
      set({
        error: error.message || '문서 이동에 실패했습니다.',
        loading: false
      });
      throw error;
    }
  },

  checkFolderAccess: async () => {
    try {
      return await folderService.checkFolderAccess();
    } catch (error) {
      console.error('Error checking folder access:', error);
      return false;
    }
  },

  getFolderPath: async (folderId: string) => {
    try {
      return await folderService.getFolderPath(folderId);
    } catch (error) {
      console.error('Error getting folder path:', error);
      return [];
    }
  },

  reset: () => {
    set({
      folders: [],
      documents: [],
      currentFolder: null,
      folderPath: [],
      loading: false,
      error: null
    });
  },

  clearError: () => {
    set({ error: null });
  }
}));