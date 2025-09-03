import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';
import { useDocumentStore } from '../stores/documentStore';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  name: string;
  position: string;
  canRequestReview?: boolean; // 검토 요청 권한
}

const DocumentNew: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId');

  const { templates, getTemplates } = useTemplateStore();
  const { createDocument, loading } = useDocumentStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    preselectedTemplateId || ''
  );
  
  // 편집자 선택 관련 state
  const [selectedEditors, setSelectedEditors] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);

  useEffect(() => {
    getTemplates();
  }, [getTemplates]);

  // 사용자 검색 함수
  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await axios.get(`http://localhost:8080/api/users/search?query=${encodeURIComponent(query)}`);
      console.log('사용자 검색 결과:', response.data);
      setSearchResults(response.data);
    } catch (error) {
      console.error('사용자 검색 실패:', error);
      setSearchResults([]);
      
      // 개발 모드에서 더 자세한 오류 정보 표시
      if (process.env.NODE_ENV === 'development') {
        console.error('검색 오류 상세:', {
          message: error instanceof Error ? error.message : '알 수 없는 오류',
          response: axios.isAxiosError(error) ? error.response?.data : null,
          status: axios.isAxiosError(error) ? error.response?.status : null
        });
      }
    } finally {
      setIsSearching(false);
    }
  };

  // 검색어 변경 시 디바운싱된 검색 실행
  useEffect(() => {
    const timer = setTimeout(() => {
      if (userSearchQuery) {
        searchUsers(userSearchQuery);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);

  // 외부 클릭 시 검색 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-search-container')) {
        setShowUserSearch(false);
      }
    };

    if (showUserSearch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserSearch]);

  // 편집자 추가
  const addEditor = (user: User) => {
    if (!selectedEditors.some(editor => editor.id === user.id)) {
      // 기본적으로 검토 요청 권한 부여
      setSelectedEditors([...selectedEditors, { ...user, canRequestReview: true }]);
    }
    setUserSearchQuery('');
    setSearchResults([]);
    setShowUserSearch(false);
  };

  // 편집자 제거
  const removeEditor = (userId: number) => {
    setSelectedEditors(selectedEditors.filter(editor => editor.id !== userId));
  };

  // 편집자 권한 토글
  const toggleEditorReviewPermission = (userId: number) => {
    setSelectedEditors(selectedEditors.map(editor => 
      editor.id === userId 
        ? { ...editor, canRequestReview: !editor.canRequestReview }
        : editor
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplateId) {
      alert('템플릿을 선택해주세요.');
      return;
    }

    try {
      await createDocument({
        templateId: parseInt(selectedTemplateId),
        editorEmail: selectedEditors.length > 0 ? selectedEditors[0].email : undefined,
      });

      alert('문서가 생성되었습니다.');
      navigate(`/documents`);
    } catch (error) {
      console.error('Document creation error:', error);
      alert('문서 생성에 실패했습니다.');
    }
  };

  const selectedTemplate = templates.find(t => t.id === parseInt(selectedTemplateId));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">새 문서 생성</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 왼쪽: 문서 생성 폼 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">문서 정보</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 템플릿 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                템플릿 선택 *
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="input"
                required
              >
                <option value="">템플릿을 선택하세요</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} (PDF 템플릿)
                  </option>
                ))}
              </select>
            </div>

            {/* 편집자 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                편집자 선택 (선택사항)
              </label>
              
              {/* 선택된 편집자들 표시 */}
              {selectedEditors.length > 0 && (
                <div className="mb-3">
                  <div className="space-y-2">
                    {selectedEditors.map((editor) => (
                      <div key={editor.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div>
                              <div className="font-medium text-gray-800">{editor.name}</div>
                              <div className="text-sm text-gray-600">{editor.email}</div>
                              <div className="text-xs text-gray-500">{editor.position}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            {/* 검토 요청 권한 토글 */}
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-600">검토 요청 권한:</span>
                              <button
                                type="button"
                                onClick={() => toggleEditorReviewPermission(editor.id)}
                                className={`px-2 py-1 text-xs rounded-full font-medium transition-colors ${
                                  editor.canRequestReview 
                                    ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {editor.canRequestReview ? '✓ 허용' : '✗ 불허'}
                              </button>
                            </div>
                            
                            {/* 제거 버튼 */}
                            <button
                              type="button"
                              onClick={() => removeEditor(editor.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              ✗
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 편집자 검색 및 추가 */}
              <div className="relative user-search-container">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    onFocus={() => setShowUserSearch(true)}
                    placeholder="편집자를 검색하여 추가하세요 (이름 또는 이메일)"
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUserSearch(!showUserSearch)}
                    className="btn btn-secondary px-3"
                  >
                    🔍
                  </button>
                </div>
                
                {/* 검색 결과 드롭다운 */}
                {showUserSearch && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isSearching ? (
                      <div className="p-3 text-center text-gray-500">
                        <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
                        검색 중...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults
                        .filter(user => user && typeof user === 'object')
                        .map((user) => {
                          // 데이터 안전성 검증
                          const safeUser = {
                            id: user.id || 0,
                            name: user.name || 'Unknown',
                            email: user.email || 'unknown@example.com',
                            position: user.position || 'Unknown Position'
                          };
                          
                          return (
                            <button
                              key={safeUser.id}
                              type="button"
                              onClick={() => addEditor(safeUser)}
                              className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                              disabled={selectedEditors.some(editor => editor.id === safeUser.id)}
                            >
                              <div className="font-medium text-gray-800">{safeUser.name}</div>
                              <div className="text-sm text-gray-600">{safeUser.email}</div>
                              <div className="text-xs text-gray-500">{safeUser.position}</div>
                              {selectedEditors.some(editor => editor.id === safeUser.id) && (
                                <div className="text-xs text-blue-600 mt-1">✓ 이미 선택됨</div>
                              )}
                            </button>
                          );
                        })
                    ) : userSearchQuery.length >= 2 ? (
                      <div className="p-3 text-center text-gray-500">
                        검색 결과가 없습니다
                      </div>
                    ) : (
                      <div className="p-3 text-center text-gray-500">
                        2글자 이상 입력해주세요
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-500 mt-2">
                편집자를 추가하지 않으면 나중에 할당할 수 있습니다.
              </p>
            </div>

            {/* 버튼 */}
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading || !selectedTemplateId}
                className="btn btn-primary flex-1"
              >
                {loading ? '생성 중...' : '문서 생성'}
              </button>
            </div>
          </form>
        </div>

        {/* 오른쪽: 템플릿 미리보기 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">템플릿 미리보기</h2>
          
          {selectedTemplate ? (
            <div>
              {/* 템플릿 기본 정보 */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-gray-800 text-lg mb-2">{selectedTemplate.name}</h3>
                {selectedTemplate.description && (
                  <p className="text-gray-600 mb-3">{selectedTemplate.description}</p>
                )}
                
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    생성일: {new Date(selectedTemplate.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    작성자: {selectedTemplate.createdByName}
                  </div>
                </div>
              </div>

              {/* PDF 기반 템플릿 미리보기 */}
              {selectedTemplate.pdfFilePath ? (
                <div>
                  <div className="mb-6">
                    {selectedTemplate.pdfImagePath && (
                      <div className="mt-4">
                        <h5 className="text-sm font-medium text-gray-700 mb-2">📸 PDF 미리보기</h5>
                        <div className="border rounded-lg overflow-hidden">
                          <img
                            src={`/${selectedTemplate.pdfImagePath}`}
                            alt="PDF 템플릿 미리보기"
                            className="w-full max-w-md mx-auto"
                            style={{ maxHeight: '400px', objectFit: 'contain' }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                parent.innerHTML = '<div class="p-8 text-center text-gray-500"><div class="text-4xl mb-2">📄</div><p>PDF 이미지를 불러올 수 없습니다</p></div>';
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📄</div>
                  <p>PDF 파일이 업로드되지 않은 템플릿입니다.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium mb-2">템플릿을 선택해주세요</h3>
              <p className="text-sm">
                왼쪽에서 템플릿을 선택하면<br />
                해당 템플릿의 상세 정보를 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentNew; 