import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import UploadExcelButton from '../components/UploadExcelButton';

const DocumentNew: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId');

  const { templates, getTemplates } = useTemplateStore();
  const { createDocument, loading } = useDocumentStore();
  const { user } = useAuthStore();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    preselectedTemplateId || ''
  );

  const [documentTitle, setDocumentTitle] = useState<string>('');

  useEffect(() => {
    getTemplates();
  }, [getTemplates]);
  
  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === parseInt(selectedTemplateId));
      if (template && !documentTitle) {
        setDocumentTitle(template.name);
      }
    }
  }, [selectedTemplateId, templates, documentTitle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplateId) {
      alert('템플릿을 선택해주세요.');
      return;
    }

    try {
      await createDocument({
        templateId: parseInt(selectedTemplateId),
        editorEmail: user?.email,
        title: documentTitle.trim() || undefined,
      });

      alert('문서가 생성되었습니다.');
      navigate(`/tasks`);
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

            {/* 문서 제목 입력 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                문서 제목 *
              </label>
              <input
                type="text"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                className="input"
                placeholder="문서 제목을 입력하세요"
                required
              />
            </div>

            {/* 선택된 템플릿 설명 (읽기 전용) */}
            {selectedTemplate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  템플릿 설명
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {selectedTemplate.description || '설명이 없습니다.'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  이 설명은 선택된 템플릿의 정보입니다. (수정 불가)
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  편집자
                </label>
                <UploadExcelButton 
                  templateId={selectedTemplateId}
                  onUploadComplete={() => {
                    // 업로드 완료 후 필요한 작업 (예: 페이지 새로고침, 알림 등)
                    console.log('Excel upload completed');
                  }}
                />
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{user?.name || '사용자'}</div>
                    <div className="text-sm text-gray-600">{user?.email || 'email@example.com'}</div>
                    <div className="text-xs text-blue-600">✓ 자동 할당 (본인)</div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                자동으로 편집자로 할당됩니다.
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
                disabled={loading || !selectedTemplateId || !documentTitle.trim()}
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