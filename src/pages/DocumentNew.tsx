import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import UploadExcelButton from '../components/UploadExcelButton';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

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
  const [stagingId, setStagingId] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);

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
      if (stagingId) {
        // 엑셀 업로드 데이터가 있는 경우 DocumentCreateRequest에 stagingId 포함
        console.log('=== 엑셀 데이터 있음! ===');
        console.log('Staging ID:', stagingId);
        console.log('Template ID:', selectedTemplateId);
        console.log('Editor Email:', user?.email);
        console.log('Document Title:', documentTitle);
        
        const requestData = {
          templateId: parseInt(selectedTemplateId),
          editorEmail: user?.email,
          title: documentTitle.trim() || undefined,
          stagingId: stagingId
        };
        
        console.log('Request data:', requestData);
        console.log('Request URL:', `${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BASE}`);
        console.log('=====================================');
        
        const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BASE}`, requestData);
        
        const result = response.data;
        console.log('Bulk commit result:', result);
        
        let message = '';
        if (result.created > 0) {
          message += `${result.created}개의 문서 생성 완료`;
        }
        if (result.skipped > 0) {
          if (message) message += ', ';
          message += `${result.skipped}개 건너뜀`;
        }
        if (result.failed > 0) {
          if (message) message += ', ';
          message += `${result.failed}개 실패`;
        }
        
        alert(message || '문서 처리가 완료되었습니다.');
      } else {
        // 엑셀파일 업로드 없을시 -> 일반 단일 문서 생성
        await createDocument({
          templateId: parseInt(selectedTemplateId),
          editorEmail: user?.email,
          title: documentTitle.trim() || undefined,
        });

        alert('문서가 생성되었습니다.');
      }
      
      navigate(`/tasks`);
    } catch (error) {
      console.error('=== Document creation error details ===');
      console.error('Error type:', typeof error);
      console.error('Error object:', error);
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { 
          response?: { 
            data?: { error?: string; message?: string; details?: unknown }; 
            status?: number; 
            statusText?: string;
            headers?: Record<string, string>;
          };
          config?: unknown;
        };
        
        console.error('Response status:', axiosError.response?.status);
        console.error('Response statusText:', axiosError.response?.statusText);
        console.error('Response data:', axiosError.response?.data);
        console.error('Response headers:', axiosError.response?.headers);
        console.error('Request config:', axiosError.config);
        
        const errorMessage = axiosError.response?.data?.error || 
                           axiosError.response?.data?.message || 
                           `문서 생성에 실패했습니다. (${axiosError.response?.status})`;
        
        console.error('Final error message:', errorMessage);
        alert(errorMessage);
      } else {
        console.error('Non-axios error:', error);
        alert('문서 생성에 실패했습니다.');
      }
      console.error('=====================================');
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
                  onUploadComplete={(newStagingId, summary) => {
                    setStagingId(newStagingId);
                    setUploadSummary(summary);
                    console.log('Excel upload completed:', { stagingId: newStagingId, summary });
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
              
              {/* 엑셀 업로드 상태 표시 */}
              {uploadSummary && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-800">
                      엑셀 업로드 완료
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    총 {uploadSummary.total}행 중 {uploadSummary.valid}개 문서 생성 예정
                    {uploadSummary.invalid > 0 && ` (${uploadSummary.invalid}개 오류)`}
                  </p>
                </div>
              )}
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
                {loading ? '생성 중...' : 
                 stagingId ? `문서 생성 (${uploadSummary?.valid || 0}개)` : '문서 생성'}
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