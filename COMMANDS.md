# HisWork Frontend - Command 관련 기능 문서화

## 개요
HisWork Frontend 프로젝트의 모든 command 관련 기능과 패턴을 문서화합니다.

## 프로젝트 구조

```
src/
├── config/              # API 설정 및 엔드포인트
├── stores/              # Zustand 상태관리 store (commands)
├── hooks/               # React Hooks (command 로직)
├── utils/               # 유틸리티 함수
├── types/               # TypeScript 타입 정의
├── components/          # React 컴포넌트
└── pages/              # 페이지 컴포넌트
```

## 1. Store Commands (상태관리 명령어)

### 1.1 AuthStore (`src/stores/authStore.ts`)

인증 관련 명령어들을 관리하는 Zustand store입니다.

#### 주요 Commands:

- **`initialize()`** - 토큰 기반 인증 초기화
  ```typescript
  initialize: () => void
  ```

- **`signup(request: SignupRequest)`** - 회원가입 처리
  ```typescript
  signup: (request: SignupRequest) => Promise<void>
  ```

- **`login(request: LoginRequest)`** - 로그인 처리  
  ```typescript
  login: (request: LoginRequest) => Promise<void>
  ```

- **`logout()`** - 로그아웃 및 토큰 제거
  ```typescript
  logout: () => void
  ```

- **`clearError()`** - 에러 상태 초기화
  ```typescript
  clearError: () => void
  ```

- **`setAuthHeader()`** - Authorization 헤더 설정
  ```typescript
  setAuthHeader: () => void
  ```

### 1.2 DocumentStore (`src/stores/documentStore.ts`)

문서 관련 CRUD 및 워크플로우 명령어를 관리합니다.

#### 주요 Commands:

- **`fetchDocuments()`** - 문서 목록 조회
  ```typescript
  fetchDocuments: () => Promise<void>
  ```

- **`createDocument(request: DocumentCreateRequest)`** - 새 문서 생성
  ```typescript
  createDocument: (request: DocumentCreateRequest) => Promise<Document>
  ```

- **`getDocument(id: number)`** - 특정 문서 조회
  ```typescript
  getDocument: (id: number) => Promise<Document>
  ```

- **`updateDocument(id: number, request: DocumentUpdateRequest)`** - 문서 업데이트
  ```typescript
  updateDocument: (id: number, request: DocumentUpdateRequest) => Promise<Document>
  ```

- **`updateDocumentSilently(id: number, request: DocumentUpdateRequest)`** - 자동 저장용 업데이트
  ```typescript
  updateDocumentSilently: (id: number, request: DocumentUpdateRequest) => Promise<boolean>
  ```

- **`submitForReview(id: number)`** - 검토 요청 제출
  ```typescript
  submitForReview: (id: number) => Promise<Document>
  ```

- **`assignEditor(id: number, editorEmail: string)`** - 작성자 할당
  ```typescript
  assignEditor: (id: number, editorEmail: string) => Promise<Document>
  ```

- **`assignReviewer(id: number, reviewerEmail: string)`** - 서명자 할당
  ```typescript
  assignReviewer: (id: number, reviewerEmail: string) => Promise<Document>
  ```

- **`downloadPdf(id: number)`** - PDF 다운로드
  ```typescript
  downloadPdf: (id: number) => Promise<void>
  ```

- **`setCurrentDocument(document: Document | null)`** - 현재 문서 설정
  ```typescript
  setCurrentDocument: (document: Document | null) => void
  ```

- **`clearCurrentDocument()`** - 현재 문서 초기화
  ```typescript
  clearCurrentDocument: () => void
  ```

### 1.3 TemplateStore (`src/stores/templateStore.ts`)

템플릿 관련 명령어를 관리합니다.

#### 주요 Commands:

- **`getTemplates()`** - 템플릿 목록 조회
  ```typescript
  getTemplates: () => Promise<void>
  ```

- **`getTemplate(id: number)`** - 특정 템플릿 조회
  ```typescript
  getTemplate: (id: number) => Promise<void>
  ```

- **`updateTemplate(id: number, data: TemplateCreateRequest)`** - 템플릿 업데이트
  ```typescript
  updateTemplate: (id: number, data: TemplateCreateRequest) => Promise<void>
  ```

- **`deleteTemplate(id: number)`** - 템플릿 삭제
  ```typescript
  deleteTemplate: (id: number) => Promise<void>
  ```

### 1.4 UserStore (`src/stores/userStore.ts`)

사용자 관련 명령어를 관리합니다.

#### 주요 Commands:

- **`searchUsers(query: string)`** - 사용자 검색
  ```typescript
  searchUsers: (query: string) => Promise<User[]>
  ```

- **`clearUsers()`** - 사용자 목록 초기화
  ```typescript
  clearUsers: () => void
  ```

- **`clearError()`** - 에러 상태 초기화
  ```typescript
  clearError: () => void
  ```

### 1.5 ReviewStore (`src/stores/reviewStore.ts`)

검토 관련 명령어를 관리합니다.

#### 주요 Commands:

- **`approveDocument(documentId: number, review: ReviewRequest)`** - 문서 승인
  ```typescript
  approveDocument: (documentId: number, review: ReviewRequest) => Promise<any>
  ```

- **`rejectDocument(documentId: number, review: ReviewRequest)`** - 문서 반려
  ```typescript
  rejectDocument: (documentId: number, review: ReviewRequest) => Promise<any>
  ```

- **`canReview(documentId: number)`** - 검토 권한 확인
  ```typescript
  canReview: (documentId: number) => Promise<boolean>
  ```

- **`clearError()`** - 에러 상태 초기화
  ```typescript
  clearError: () => void
  ```

## 2. Hook Commands (React Hooks)

### 2.1 useDocumentEditor (`src/hooks/useDocumentEditor.ts`)

문서 편집 관련 명령어를 제공하는 커스텀 Hook입니다.

#### 주요 Commands:

- **`updateFieldValue(fieldId: string, value: any)`** - 필드 값 업데이트
  ```typescript
  updateFieldValue: (fieldId: string, value: any) => void
  ```

- **`updateTableCell(fieldId: string, rowIndex: number, colIndex: number, value: string)`** - 테이블 셀 업데이트
  ```typescript
  updateTableCell: (fieldId: string, rowIndex: number, colIndex: number, value: string) => void
  ```

- **`setCoordinateFields(fields: CoordinateField[])`** - 좌표 필드 설정
  ```typescript
  setCoordinateFields: (fields: CoordinateField[]) => void
  ```

- **`setDocumentData(data: any)`** - 문서 데이터 설정
  ```typescript
  setDocumentData: (data: any) => void
  ```

#### 특징:
- Debounced 자동 저장 기능 제공
- 테이블 데이터 편집 지원
- 필드별 데이터 상태 관리

### 2.2 useTemplateFields (`src/hooks/useTemplateFields.ts`)

템플릿 필드 관련 명령어를 제공합니다.

#### 주요 Commands:

- **`addField(field: TemplateField)`** - 필드 추가
  ```typescript
  addField: (field: TemplateField) => void
  ```

- **`updateField(fieldId: string, updates: Partial<TemplateField>)`** - 필드 업데이트
  ```typescript
  updateField: (fieldId: string, updates: Partial<TemplateField>) => void
  ```

- **`deleteField(fieldId: string)`** - 필드 삭제
  ```typescript
  deleteField: (fieldId: string) => void
  ```

- **`selectField(fieldId: string | null)`** - 필드 선택
  ```typescript
  selectField: (fieldId: string | null) => void
  ```

- **`getSelectedField()`** - 선택된 필드 조회
  ```typescript
  getSelectedField: () => TemplateField | undefined
  ```

- **`clearFields()`** - 모든 필드 초기화
  ```typescript
  clearFields: () => void
  ```

### 2.3 usePdfCanvas (`src/hooks/usePdfCanvas.ts`)

PDF 캔버스 관련 명령어를 제공합니다.

#### 주요 Commands:

- **`startSelection(position: Position)`** - 선택 영역 시작
  ```typescript
  startSelection: (position: Position) => void
  ```

- **`updateSelection(currentPosition: Position)`** - 선택 영역 업데이트
  ```typescript
  updateSelection: (currentPosition: Position) => void
  ```

- **`endSelection()`** - 선택 영역 종료
  ```typescript
  endSelection: () => void
  ```

## 3. Utility Commands (유틸리티 함수)

### 3.1 debounce (`src/utils/debounce.ts`)

#### Commands:

- **`createDebounce<T>(func: T, wait: number)`** - Debounce 함수 생성
  ```typescript
  createDebounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void)
  ```

### 3.2 logger (`src/utils/logger.ts`)

로깅 관련 명령어를 제공합니다.

#### Commands:

- **`logger.debug(...args: any[])`** - 개발 환경에서만 디버그 로그
- **`logger.info(...args: any[])`** - 개발 환경에서만 정보 로그  
- **`logger.warn(...args: any[])`** - 경고 로그
- **`logger.error(...args: any[])`** - 에러 로그

### 3.3 coordinateUtils (`src/utils/coordinateUtils.ts`)

좌표 변환 관련 명령어들:

- **`pixelToRatio(pixelValue: number, maxValue: number)`** - 픽셀을 비율로 변환
- **`ratioToPixel(ratio: number, maxValue: number)`** - 비율을 픽셀로 변환
- **`convertPixelToRatio(coordinates, containerSize)`** - 픽셀 좌표를 비율로 변환
- **`convertRatioToPixel(coordinates, containerSize)`** - 비율 좌표를 픽셀로 변환
- **`validateRatioCoordinates(coordinates)`** - 비율 좌표 검증
- **`validatePixelCoordinates(coordinates)`** - 픽셀 좌표 검증
- **`logCoordinateConversion(...args)`** - 좌표 변환 로그

### 3.4 coordinateDebugger (`src/utils/coordinateDebugger.ts`)

좌표 디버깅 관련 명령어들:

- **`testCoordinateConversion(label: string, originalPixels: DebugCoordinate)`** - 좌표 변환 테스트
- **`runCoordinateTests()`** - 좌표 변환 테스트 실행
- **`compareCoordinates(coord1, coord2, tolerance)`** - 좌표 비교
- **`debugTemplateField(field, stage)`** - 템플릿 필드 디버깅

## 4. API Commands (API 설정)

### 4.1 api.ts (`src/config/api.ts`)

API 엔드포인트 설정:

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
  },
  DOCUMENTS: {
    BASE: '/documents',
    BY_ID: (id: number | string) => `/documents/${id}`,
    FIELD_VALUES: (id: number | string) => `/documents/${id}/field-values`,
    START_EDITING: (id: number | string) => `/documents/${id}/start-editing`,
    COMPLETE_EDITING: (id: number | string) => `/documents/${id}/complete-editing`,
    SUBMIT_FOR_REVIEW: (id: number | string) => `/documents/${id}/submit-for-review`,
    ASSIGN_EDITOR: (id: number | string) => `/documents/${id}/assign-editor`,
    ASSIGN_REVIEWER: (id: number | string) => `/documents/${id}/assign-reviewer`,
    DOWNLOAD_PDF: (id: number | string) => `/documents/${id}/download-pdf`,
  },
  TEMPLATES: {
    BASE: '/templates',
    BY_ID: (id: number | string) => `/templates/${id}`,
  },
  PDF: {
    CONVERT_TO_IMAGE: '/pdf/convert-to-image',
  },
}
```

## 5. Component Commands (React 컴포넌트 내 명령어)

### 5.1 SignatureModal (`src/components/SignatureModal.tsx`)

서명 모달 관련 canvas 조작 명령어들:

#### 주요 Commands:

- **`getCanvasCoordinates(e)`** - 마우스/터치 좌표를 캔버스 좌표로 변환
- **`startDrawing(e)`** - 그리기 시작
- **`draw(e)`** - 그리기 진행
- **`stopDrawing()`** - 그리기 종료
- **`clearCanvas()`** - 캔버스 초기화
- **`saveSignature()`** - 서명 데이터 저장

### 5.2 PdfViewer (`src/components/pdf/PdfViewer.tsx`)

PDF 뷰어 관련 명령어들:

- **`loadPdf()`** - PDF 로드
- **`renderPage()`** - 페이지 렌더링
- **`zoomIn()`** - 확대
- **`zoomOut()`** - 축소
- **`goToPage(pageNumber)`** - 특정 페이지로 이동

### 5.3 Form Handler Commands

각 페이지 및 컴포넌트에서 사용되는 일반적인 폼 처리 명령어들:

- **`handleChange(e: React.ChangeEvent)`** - 입력 필드 변경 처리
- **`handleSubmit(e: React.FormEvent)`** - 폼 제출 처리
- **`handleSave()`** - 저장 처리
- **`handleDelete()`** - 삭제 처리
- **`handleUpdate()`** - 업데이트 처리
- **`handleCancel()`** - 취소 처리

## 6. 사용 패턴

### 6.1 Store 사용 패턴

```typescript
// Store hook 사용
const { fetchDocuments, createDocument, loading, error } = useDocumentStore();

// 비동기 command 실행
await fetchDocuments();
const newDocument = await createDocument(documentData);
```

### 6.2 Hook 사용 패턴

```typescript
// Custom hook 사용
const { updateFieldValue, updateTableCell, isSaving } = useDocumentEditor();

// 필드 값 업데이트
updateFieldValue('field1', 'new value');
```

### 6.3 에러 처리 패턴

```typescript
try {
  await documentStore.createDocument(data);
} catch (error) {
  logger.error('Document creation failed:', error);
  // 에러 처리 로직
}
```

## 7. 명명 규칙

### 7.1 Command 명명 규칙

- **CRUD Operations**: `get`, `create`, `update`, `delete`
- **State Management**: `set`, `clear`, `initialize`
- **Actions**: `submit`, `assign`, `download`
- **Validation**: `validate`
- **Conversion**: `convert`, `transform`
- **Debug**: `debug`, `test`, `log`

### 7.2 파일 명명 규칙

- **Stores**: `[domain]Store.ts` (예: `authStore.ts`)
- **Hooks**: `use[Domain][Purpose].ts` (예: `useDocumentEditor.ts`)
- **Utils**: `[purpose].ts` (예: `debounce.ts`)
- **Config**: `[purpose].ts` (예: `api.ts`)

## 8. 개발 가이드라인

### 8.1 새로운 Command 추가 시

1. 적절한 도메인의 Store 또는 Hook에 추가
2. TypeScript 타입 정의 확인
3. 에러 처리 로직 포함
4. 로깅 추가 (개발/디버깅용)
5. 이 문서 업데이트

### 8.2 Store Command 작성 시 주의사항

- 비동기 작업 시 `loading` 상태 관리
- 적절한 에러 메시지 한국어로 작성
- console.log 대신 logger 유틸리티 사용
- 상태 업데이트 시 불변성 유지

### 8.3 Hook Command 작성 시 주의사항

- useCallback을 사용한 메모이제이션
- 의존성 배열 정확히 지정
- 컴포넌트 리렌더링 최적화 고려

### 8.4 Component Command 작성 시 주의사항

- 이벤트 핸들러는 `handle[ActionName]` 형식으로 명명
- 사용자 인터랙션에 대한 적절한 피드백 제공
- 접근성(a11y) 고려
- 에러 바운더리 및 fallback UI 구현
