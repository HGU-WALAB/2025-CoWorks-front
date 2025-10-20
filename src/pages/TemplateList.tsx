import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';
import { useAuthStore } from '../stores/authStore';
import { Template } from '../types/template';
import TemplateDuplicateModal from '../components/TemplateDuplicateModal';
import AssignedUsersModal from '../components/AssignedUsersModal';
import { downloadExcelTemplate } from '../utils/excelDownloadUtils';
import { formatKoreanFullDateTime } from '../utils/roleAssignmentUtils';

const TemplateList: React.FC = () => {
  const navigate = useNavigate();
  const { templates, loading, error, getTemplates, deleteTemplate, duplicateTemplate } = useTemplateStore();
  const { user, refreshUser } = useAuthStore();
  const [hasFolderAccess, setHasFolderAccess] = useState<boolean>(false);
  
  // 복제 모달 상태
  const [duplicateModal, setDuplicateModal] = useState<{
    isOpen: boolean;
    template: Template | null;
  }>({
    isOpen: false,
    template: null,
  });
  const [duplicateLoading, setDuplicateLoading] = useState(false);

  // 할당된 사용자 모달 상태
  const [assignedUsersModal, setAssignedUsersModal] = useState<{
    isOpen: boolean;
    template: Template | null;
  }>({
    isOpen: false,
    template: null,
  });

  useEffect(() => {
    refreshUser().then(() => {
      const updatedUser = useAuthStore.getState().user;
      setHasFolderAccess((updatedUser as unknown as { hasFolderAccess?: boolean })?.hasFolderAccess === true);
    });
    getTemplates();
  }, [getTemplates, refreshUser]);

  const handleCreateDocument = (templateId: number, mode: 'single' | 'bulk' = 'single') => {
    navigate(`/documents/new?templateId=${templateId}&mode=${mode}`);
  };
  
  const isTemplateOwner = (template: Template) => {
    return user?.name === template.createdByName;
  };

  const handleDeleteTemplate = async (templateId: number, templateName: string) => {
    if (window.confirm(`"${templateName}" 템플릿을 삭제하시겠습니까?`)) {
      try {
        await deleteTemplate(templateId);
        alert('템플릿이 삭제되었습니다.');
      } catch (error: unknown) {
        // 서버에서 오는 구체적인 오류 메시지 사용
        const errorMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || '템플릿 삭제에 실패했습니다.';
        alert(errorMessage);
      }
    }
  };

  const handleDuplicateTemplate = (template: Template) => {
    setDuplicateModal({
      isOpen: true,
      template,
    });
  };

  const handleConfirmDuplicate = async (newName: string, description: string, folderId: string | null) => {
    if (!duplicateModal.template) return;

    setDuplicateLoading(true);
    try {
      await duplicateTemplate(duplicateModal.template.id, newName, description, folderId);
      alert(`"${newName}" 템플릿이 복제되었습니다.`);
      setDuplicateModal({ isOpen: false, template: null });
    } catch {
      alert('템플릿 복제에 실패했습니다.');
    } finally {
      setDuplicateLoading(false);
    }
  };

  const handleCloseDuplicateModal = () => {
    setDuplicateModal({ isOpen: false, template: null });
  };

  const handleShowAssignedUsers = (template: Template) => {
    setAssignedUsersModal({
      isOpen: true,
      template,
    });
  };

  const handleCloseAssignedUsersModal = () => {
    setAssignedUsersModal({ isOpen: false, template: null });
  };

  const handleDownloadExcelTemplate = () => {
    downloadExcelTemplate();
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
              {hasFolderAccess && (
                <>
                  <Link to="/templates/pdf/upload" className="btn btn-primary">
                    📄 PDF 템플릿 업로드
                  </Link>
                  <button
                    onClick={handleDownloadExcelTemplate}
                    className="px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700 rounded-md hover:from-green-100 hover:to-emerald-100 transition-colors flex items-center font-medium"
                    title="사용자 할당을 위한 엑셀 템플릿 다운로드"
                  >
                    📊 엑셀 템플릿 다운로드
                  </button>
                </>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {template.name}
                      </h3>
                      {/* 할당된 사용자 보기 버튼 (권한 있는 사용자만) */}
                      {hasFolderAccess && (
                        <button
                          onClick={() => handleShowAssignedUsers(template)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                          title="할당된 사용자 보기"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    <div className="h-8 mb-3">
                      <p 
                        className="text-gray-400 text-sm leading-4 overflow-hidden"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          lineHeight: '1rem',
                          maxHeight: '2rem'
                        }}
                      >
                        {template.description || '(없음)'}
                      </p>
                    </div>

                    {/* 메타 정보 */}
                    <div className="mb-3 text-xs text-gray-400">
                      <div>생성자: {template.createdByName}</div>
                      <div>생성일: {formatKoreanFullDateTime(template.createdAt)}</div>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="space-y-2">
                      {hasFolderAccess ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleCreateDocument(template.id, 'single')}
                            className="flex-1 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            개인문서 생성
                          </button>
                          <button
                            onClick={() => handleCreateDocument(template.id, 'bulk')}
                            className="flex-1 px-3 py-1.5 text-sm bg-white border border-blue-300 text-blue-600 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            문서 할당
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCreateDocument(template.id, 'single')}
                          className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          문서 생성
                        </button>
                      )}
                      
                      <div className="flex space-x-2">
                        {isTemplateOwner(template) && (
                          <>
                            <Link
                              to={`/templates/edit/${template.id}`}
                              className="flex-1 px-2 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
                              title="템플릿 편집"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              편집
                            </Link>
                            
                            <button
                              onClick={() => handleDuplicateTemplate(template)}
                              className="flex-1 px-2 py-1.5 text-sm text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors flex items-center justify-center"
                              title="템플릿 복제"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              복제
                            </button>
                            
                            <button
                              onClick={() => handleDeleteTemplate(template.id, template.name)}
                              className="flex-1 px-2 py-1.5 text-sm text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 transition-colors flex items-center justify-center"
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 복제 확인 모달 */}
      <TemplateDuplicateModal
        isOpen={duplicateModal.isOpen}
        onClose={handleCloseDuplicateModal}
        onConfirm={handleConfirmDuplicate}
        originalName={duplicateModal.template?.name || ''}
        originalDescription={duplicateModal.template?.description || ''}
        originalFolderId={duplicateModal.template?.defaultFolderId || null}
        loading={duplicateLoading}
      />

      {/* 할당된 사용자 보기 모달 */}
      <AssignedUsersModal
        isOpen={assignedUsersModal.isOpen}
        onClose={handleCloseAssignedUsersModal}
        templateId={assignedUsersModal.template?.id || 0}
        templateName={assignedUsersModal.template?.name || ''}
      />
    </div>
  );
};

export default TemplateList; 