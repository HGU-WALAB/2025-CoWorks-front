import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';
import { useAuthStore } from '../stores/authStore';
import { Template } from '../types/template';

const TemplateList: React.FC = () => {
  const navigate = useNavigate();
  const { templates, loading, error, getTemplates, deleteTemplate } = useTemplateStore();
  const { user } = useAuthStore();

  useEffect(() => {
    getTemplates();
  }, [getTemplates]);

  const handleCreateDocument = (templateId: number) => {
    navigate(`/documents/new?templateId=${templateId}`);
  };
  
  const isTemplateOwner = (template: Template) => {
    return user?.name === template.createdByName;
  };

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    if (window.confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) {
      try {
        await deleteTemplate(templateId);
        alert('템플릿이 삭제되었습니다.');
      } catch (error) {
        alert('템플릿 삭제에 실패했습니다.');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">템플릿을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">템플릿 관리</h1>
            <div className="flex space-x-3">
              <Link to="/templates/pdf/upload" className="btn btn-primary">
                📄 PDF 템플릿 업로드
              </Link>
            </div>
          </div>
        </div>

        <div className="p-6">
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg mb-4">
                아직 생성된 템플릿이 없습니다.
              </div>
              <Link
                to="/templates/pdf/upload"
                className="btn btn-primary"
              >
                첫 번째 템플릿 만들기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div key={template.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border">
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      {template.name}
                    </h3>
                    
                    <div className="h-10 mb-4">
                      <p 
                        className="text-gray-400 text-sm leading-5 overflow-hidden"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          lineHeight: '1.25rem',
                          maxHeight: '2.5rem'
                        }}
                      >
                        {template.description || '(없음)'}
                      </p>
                    </div>



                    {/* 메타 정보 */}
                    <div className="mb-4 text-xs text-gray-400">
                      <div>생성자: {template.createdByName}</div>
                      <div>생성일: {new Date(template.createdAt).toLocaleDateString()}</div>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleCreateDocument(template.id)}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-500 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-center flex-1"
                        style={{ color: '#333333' }}
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        문서 생성
                      </button>
                      {isTemplateOwner(template) && (
                        <>
                          <Link
                            to={`/templates/edit/${template.id}`}
                            className="px-3 py-1.5 text-sm  bg-white border border-gray-500 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
                            title="템플릿 편집"
                            style={{ color: '#333333' }}
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            편집
                          </Link>
                          <button
                            onClick={() => handleDeleteTemplate(template.id, template.name)}
                            className="px-3 py-1.5 text-sm text-red-600 bg-white border border-red-400 rounded-md hover:bg-red-50 transition-colors flex items-center justify-center"
                            title="템플릿 삭제"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateList; 