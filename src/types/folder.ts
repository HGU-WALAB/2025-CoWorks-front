// 폴더 관련 타입 정의
import { Document } from './document';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string | null;
  fullPath: string;
  childrenCount: number;
  documentsCount: number;
  children?: Folder[];
}

export interface FolderCreateRequest {
  name: string;
  parentId: string | null;
}

export interface FolderUpdateRequest {
  name?: string;
  parentId?: string | null;
}

export interface FolderContents {
  folders: Folder[];
  documents: Document[];
}

export interface DocumentMoveRequest {
  targetFolderId: string | null; // null이면 미분류로 이동
}

// 폴더 트리 노드 타입
export interface FolderTreeNode extends Folder {
  isExpanded?: boolean;
  level?: number;
}

// 폴더 상태 관리 타입
export interface FolderState {
  // 데이터
  folders: Folder[];
  documents: Document[];
  currentFolder: Folder | null;
  folderPath: Folder[];
  
  // UI 상태
  loading: boolean;
  error: string | null;
  
  // 액션
  loadFolderContents: (folderId: string | null) => Promise<void>;
  createFolder: (name: string, parentId: string | null) => Promise<void>;
  updateFolder: (id: string, name: string) => Promise<void>;
  renameFolder: (id: string, newName: string) => Promise<void>;
  moveFolder: (id: string, targetParentId: string | null) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveDocument: (documentId: string, targetFolderId: string | null) => Promise<void>;
  checkFolderAccess: () => Promise<boolean>;
  getFolderPath: (folderId: string) => Promise<Folder[]>;
  reset: () => void;
}

// Component Props Types
export interface FolderPageProps {
  // URL 파라미터는 useParams로 가져오므로 props 없음
}

export interface FolderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (folderName: string) => Promise<void>;
  parentFolderName?: string | null;
  loading?: boolean;
}

export interface BreadcrumbProps {
  folderPath: Folder[];
  onNavigate: (folderId: string | null) => void;
}

export interface FolderGridProps {
  folders: Folder[];
  documents: Document[];
  onFolderClick: (folderId: string) => void;
  onDocumentClick: (documentId: string) => void;
  onContextMenu: (
    event: React.MouseEvent, 
    item: Folder | Document, 
    type: 'folder' | 'document'
  ) => void;
}

export interface ItemCardProps {
  item: Folder | Document;
  type: 'folder' | 'document';
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export interface ContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  targetItem: Folder | Document | null;
  targetType: 'folder' | 'document' | null;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export interface CreateFolderModalProps {
  isOpen: boolean;
  parentId: string | null;
  parentName?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export interface RenameModalProps {
  isOpen: boolean;
  item: Folder | Document | null;
  type: 'folder' | 'document' | null;
  onClose: () => void;
  onSuccess: () => void;
}

export interface DocumentMoveModalProps {
  isOpen: boolean;
  document: Document | null;
  onClose: () => void;
  onSuccess: () => void;
}

export interface AccessDeniedProps {
  onGoHome?: () => void;
}