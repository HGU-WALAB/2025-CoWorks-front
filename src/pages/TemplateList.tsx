import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';

const TemplateList: React.FC = () => {
  const navigate = useNavigate();
  const { templates, loading, error, getTemplates, deleteTemplate } = useTemplateStore();

  useEffect(() => {
    getTemplates();
  }, [getTemplates]);

  const handleCreateDocument = (templateId: number) => {
    navigate(`/documents/new?templateId=${templateId}`);
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
                    
                    {template.description && (
                      <p className="text-gray-600 mb-4">
                        {template.description}
                      </p>
                    )}



                    {/* 메타 정보 */}
                    <div className="mb-4 text-xs text-gray-400">
                      <div>생성자: {template.createdByName}</div>
                      <div>생성일: {new Date(template.createdAt).toLocaleDateString()}</div>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleCreateDocument(template.id)}
                        className="btn btn-primary flex-1 text-center text-sm"
                      >
                        📄 문서 생성
                      </button>
                      <Link
                        to={`/templates/edit/${template.id}`}
                        className="btn bg-green-600 text-white hover:bg-green-700 text-sm px-3 flex items-center justify-center"
                      >
                        ✏️
                      </Link>
                      <button
                        onClick={() => handleDeleteTemplate(template.id, template.name)}
                        className="btn bg-red-600 text-white hover:bg-red-700 text-sm px-3"
                      >
                        🗑️
                      </button>
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