import axios from 'axios';
import { 
  Folder, 
  FolderCreateRequest, 
  FolderUpdateRequest, 
  FolderContents,
  DocumentMoveRequest 
} from '../types/folder';
import { Document } from '../types/document';
import { API_BASE_URL } from '../config/api';

class FolderService {
  private baseUrl = `${API_BASE_URL}/folders`;

  /**
   * API 호출 전 인증 헤더 확인 및 설정
   */
  private ensureAuthHeader() {
    console.log('🔍 Checking auth header...');
    
    // 1. localStorage에서 토큰 확인
    const authStorage = localStorage.getItem('auth-storage');
    console.log('📦 Auth storage:', authStorage);
    
    if (authStorage) {
      try {
        const authData = JSON.parse(authStorage);
        console.log('📋 Parsed auth data:', authData);
        
        if (authData.state?.token) {
          const token = authData.state.token;
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          console.log('✅ Auth header set:', `Bearer ${token.substring(0, 20)}...`);
          console.log('🔧 Current axios headers:', axios.defaults.headers.common);
        } else {
          console.warn('⚠️ No token found in auth data');
        }
      } catch (error) {
        console.error('❌ Error parsing auth token:', error);
      }
    } else {
      console.warn('⚠️ No auth storage found');
    }
  }

  /**
   * 폴더 접근 권한 확인
   */
  async checkFolderAccess(): Promise<boolean> {
    try {
      this.ensureAuthHeader();
      const response = await axios.get(`${this.baseUrl}/access-check`);
      return response.data;
    } catch (error: any) {
      console.error('Error checking folder access:', error);
      return false;
    }
  }

  /**
   * 루트 폴더 목록 조회
   */
  async getRootFolders(): Promise<Folder[]> {
    try {
      this.ensureAuthHeader();
      const response = await axios.get(this.baseUrl);
      return response.data;
    } catch (error) {
      console.error('Error fetching root folders:', error);
      throw new Error('루트 폴더 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * 폴더 트리 구조 조회 (모든 폴더와 하위 폴더)
   */
  async getFolderTree(): Promise<Folder[]> {
    try {
      this.ensureAuthHeader();
      const response = await axios.get(`${this.baseUrl}/tree`);
      return response.data;
    } catch (error) {
      console.error('Error fetching folder tree:', error);
      throw new Error('폴더 트리를 가져오는데 실패했습니다.');
    }
  }

  /**
   * 특정 폴더의 내용 조회 (하위 폴더 + 문서)
   */
  async getFolderContents(folderId: string): Promise<FolderContents> {
    try {
      this.ensureAuthHeader();
      const [foldersResponse, documentsResponse] = await Promise.all([
        axios.get(`${this.baseUrl}/${folderId}/children`),
        axios.get(`${this.baseUrl}/${folderId}/documents`)
      ]);

      return {
        folders: foldersResponse.data,
        documents: documentsResponse.data
      };
    } catch (error) {
      console.error('Error fetching folder contents:', error);
      throw new Error('폴더 내용을 가져오는데 실패했습니다.');
    }
  }

  /**
   * 특정 폴더 정보 조회
   */
  async getFolder(folderId: string): Promise<Folder> {
    try {
      const response = await axios.get(`${this.baseUrl}/${folderId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching folder:', error);
      throw new Error('폴더 정보를 가져오는데 실패했습니다.');
    }
  }

  /**
   * 폴더 생성
   */
  async createFolder(request: FolderCreateRequest): Promise<Folder> {
    try {
      const response = await axios.post(this.baseUrl, request);
      return response.data;
    } catch (error: any) {
      console.error('Error creating folder:', error);
      const errorMessage = error.response?.data?.message || '폴더 생성에 실패했습니다.';
      throw new Error(errorMessage);
    }
  }

  /**
   * 폴더 수정 (이름 변경)
   */
  async updateFolder(folderId: string, request: FolderUpdateRequest): Promise<Folder> {
    try {
      const response = await axios.put(`${this.baseUrl}/${folderId}`, request);
      return response.data;
    } catch (error: any) {
      console.error('Error updating folder:', error);
      const errorMessage = error.response?.data?.message || '폴더 수정에 실패했습니다.';
      throw new Error(errorMessage);
    }
  }

  /**
   * 폴더 이름 변경 (간편 메서드)
   */
  async renameFolder(folderId: string, newName: string): Promise<Folder> {
    return this.updateFolder(folderId, { name: newName });
  }

  /**
   * 폴더 삭제
   */
  async deleteFolder(folderId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/${folderId}`);
    } catch (error: any) {
      console.error('Error deleting folder:', error);
      const errorMessage = error.response?.data?.message || '폴더 삭제에 실패했습니다.';
      throw new Error(errorMessage);
    }
  }

  /**
   * 폴더 경로 조회 (브레드크럼용)
   */
  async getFolderPath(folderId: string): Promise<Folder[]> {
    try {
      // 현재 폴더부터 루트까지의 경로를 구성
      const path: Folder[] = [];
      let currentFolder = await this.getFolder(folderId);
      
      while (currentFolder) {
        path.unshift(currentFolder); // 앞쪽에 추가하여 루트부터 현재 폴더 순으로 정렬
        
        if (currentFolder.parentId) {
          currentFolder = await this.getFolder(currentFolder.parentId);
        } else {
          break;
        }
      }
      
      return path;
    } catch (error) {
      console.error('Error getting folder path:', error);
      return [];
    }
  }

  /**
   * 미분류 문서 목록 조회
   */
  async getUnclassifiedDocuments(): Promise<Document[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/unclassified/documents`);
      return response.data;
    } catch (error) {
      console.error('Error fetching unclassified documents:', error);
      throw new Error('미분류 문서 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * 폴더 이동 (부모 폴더 변경)
   */
  async moveFolder(folderId: string, targetParentId: string | null): Promise<Folder> {
    try {
      // 인증 헤더 확인 및 설정
      this.ensureAuthHeader();
      
      console.log('Moving folder:', { folderId, targetParentId });
      console.log('Current axios headers:', axios.defaults.headers.common);
      
      // 현재 폴더 정보를 먼저 가져와서 이름을 유지
      const currentFolder = await this.getFolder(folderId);
      
      const request: FolderUpdateRequest = { 
        name: currentFolder.name,  // 기존 이름 유지
        parentId: targetParentId 
      };
      const response = await axios.put(`${this.baseUrl}/${folderId}`, request);
      return response.data;
    } catch (error: any) {
      console.error('Error moving folder:', error);
      console.error('Error response:', error.response);
      
      if (error.response?.status === 401) {
        const errorMessage = '인증이 필요합니다. 다시 로그인해주세요.';
        throw new Error(errorMessage);
      }
      
      const errorMessage = error.response?.data?.message || '폴더 이동에 실패했습니다.';
      throw new Error(errorMessage);
    }
  }

  /**
   * 문서를 폴더로 이동
   */
  async moveDocumentToFolder(documentId: string, targetFolderId: string | null): Promise<void> {
    try {
      const request: DocumentMoveRequest = { targetFolderId };
      await axios.put(`${this.baseUrl}/documents/${documentId}/move`, request);
    } catch (error: any) {
      console.error('Error moving document:', error);
      const errorMessage = error.response?.data?.message || '문서 이동에 실패했습니다.';
      throw new Error(errorMessage);
    }
  }

  /**
   * 폴더에서 문서 제거 (미분류로 이동)
   */
  async removeDocumentFromFolder(documentId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/documents/${documentId}`);
    } catch (error: any) {
      console.error('Error removing document from folder:', error);
      const errorMessage = error.response?.data?.message || '폴더에서 문서 제거에 실패했습니다.';
      throw new Error(errorMessage);
    }
  }
}

export const folderService = new FolderService();
export default folderService;