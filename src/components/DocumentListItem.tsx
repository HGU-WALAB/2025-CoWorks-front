import React from 'react';
import { Link } from 'react-router-dom';
import { Document, TaskInfo, CoordinateField } from '../types/document';
import { useAuthStore } from '../stores/authStore';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';
import { getRoleAssignmentMessage, formatKoreanFullDateTime } from '../utils/roleAssignmentUtils';

type ExtendedTaskInfo = TaskInfo & Partial<{
  assignedUser: { name?: string; username?: string };
  user: { name?: string; username?: string };
  userName: string;
  name: string;
}>;

interface DocumentListItemProps {
  document: Document;
  onPreview: (documentId: number) => void;
  onWorkflow: (document: Document) => void;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onSelect?: (documentId: number, selected: boolean) => void;
  showAssigneeInfo?: boolean;
}

const DocumentListItem: React.FC<DocumentListItemProps> = ({
  document,
  onPreview,
  onWorkflow,
  showCheckbox = false,
  isSelected = false,
  onSelect,
  showAssigneeInfo = false,
}) => {
  const { user: currentUser } = useAuthStore();

  // 문서의 모든 담당자 정보를 반환하는 함수
  const getTaskAssignees = (doc: Document) => {
    const assignees = {
      creator: doc.tasks?.find(task => task.role === 'CREATOR'),
      editor: doc.tasks?.find(task => task.role === 'EDITOR'),
        signer: doc.tasks?.find(task => task.role === 'SIGNER'),
      reviewer: doc.tasks?.find(task => task.role === 'REVIEWER')
    };

    return assignees;
  };

  // 담당자 정보 렌더링 함수
  const renderAssigneeInfo = (assignee: TaskInfo | undefined | null, role: string, colorClass: string) => {
    // assignee가 없거나, assignedUserName과 assignedUserEmail이 모두 null인 경우
    if (!assignee || (!assignee.assignedUserName && !assignee.assignedUserEmail)) {
      return (
        <div className="flex items-center space-x-1 text-xs text-gray-400">
          <div className={`w-2 h-2 rounded-full ${colorClass} opacity-30`}></div>
          <span>{role}: 미할당</span>
        </div>
      );
    }

    // 다양한 경로에서 사용자 이름 찾기
    const extendedAssignee = assignee as ExtendedTaskInfo;
    const userName = assignee.assignedUserName || 
                    assignee.assignedUserEmail || // 이메일이라도 표시
                    extendedAssignee.assignedUser?.name || 
                    extendedAssignee.assignedUser?.username ||
                    extendedAssignee.user?.name ||
                    extendedAssignee.user?.username ||
                    extendedAssignee.userName ||
                    extendedAssignee.name ||
                    '이름 없음';

    return (
      <div className="flex items-center space-x-1 text-xs">
        <div className={`w-2 h-2 rounded-full ${colorClass}`}></div>
        <span className="text-gray-600">{role}:</span>
        <span className="font-medium">{userName}</span>
      </div>
    );
  };

  // 현재 사용자가 서명자인지 확인하는 함수
  const isCurrentUserReviewer = () => {
    return document.tasks?.some(task => 
      task.role === 'REVIEWER' && task.assignedUserEmail === currentUser?.email
    );
  };

  // 상태별 액션 버튼 렌더링
  const renderActionButton = () => {
    if (document.status === 'COMPLETED') {
      return (
        <span className="px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          완료
        </span>
      );
    }

    if (document.status === 'REVIEWING') {
      // 서명 진행 상황 계산
      const totalReviewers = document.tasks?.filter(task => task.role === 'REVIEWER').length || 0;
      const signedCount = document.data?.coordinateFields?.filter(
        (field: CoordinateField) => 
          field.type === 'reviewer_signature' &&
          field.value && 
          field.value !== null && 
          field.value !== ''
      ).length || 0;

      const isReviewer = isCurrentUserReviewer();

      if (!isReviewer) {
        return (
          <span className="px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md flex items-center cursor-not-allowed">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            검토 대기중
          </span>
        );
      }

      return (
        <div className="flex items-center gap-2">
          <Link
            to={`/documents/${document.id}/review`}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            검토
          </Link>
          {totalReviewers > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {signedCount}/{totalReviewers} 서명
            </span>
          )}
        </div>
      );
    }

    if (document.status === 'READY_FOR_REVIEW') {
      return (
        <Link
          to={`/documents/${document.id}/signer-assignment`}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors font-medium flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          서명자 지정하기
        </Link>
      );
    }

    if (document.status === 'SIGNING') {
      // 서명 진행 상황 계산
      const totalSigners = document.tasks?.filter(task => task.role === 'SIGNER').length || 0;
      const signedCount = document.data?.coordinateFields?.filter(
        (field: CoordinateField) => 
          (field.type === 'signer_signature' || field.type === 'reviewer_signature') &&
          field.value && 
          field.value !== null && 
          field.value !== ''
      ).length || 0;

      // 현재 사용자가 서명자인지 확인
      const isCurrentUserSigner = document.tasks?.some(task => 
        task.role === 'SIGNER' && task.assignedUserEmail === currentUser?.email
      );

      if (!isCurrentUserSigner) {
        return (
          <span className="px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md flex items-center cursor-not-allowed">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            서명 대기중
          </span>
        );
      }

      return (
        <div className="flex items-center space-x-2">
          <Link
            to={`/documents/${document.id}/sign`}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            서명하기
          </Link>
          {totalSigners > 0 && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {signedCount}/{totalSigners} 서명
            </span>
          )}
        </div>
      );
    }

    if (document.status === 'REJECTED') {
      // 현재 사용자가 서명자인 경우 편집 버튼 비활성화
      if (isCurrentUserReviewer()) {
        return (
          <span className="px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-md flex items-center cursor-not-allowed">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            작성 불가
          </span>
        );
      }
      // 서명자가 아닌 경우 편집 가능
      return (
        <Link
          to={`/documents/${document.id}/edit`}
          className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          작성하기
        </Link>
      );
    }

    // 편집 가능한 상태 (DRAFT, EDITING)
    return (
      <Link
        to={`/documents/${document.id}/edit`}
        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        작성
      </Link>
    );
  };



  return (
    <div className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-start gap-3">
          {showCheckbox && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => onSelect?.(document.id, e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className={`${showCheckbox ? 'text-sm' : 'text-lg'} font-semibold text-gray-900 leading-tight truncate`}>
                {document.title || document.templateName}
              </h3>
              <StatusBadge
                status={document.status}
                size="sm"
                isRejected={document.isRejected}
                rejectComment={
                  document.isRejected &&
                  document.status === 'EDITING' &&
                  document.statusLogs
                    ? document.statusLogs
                        .filter(log => log.status === 'EDITING')
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.comment
                    : undefined
                }
              />
              {/* 현재 사용자에게 새로 할당된 작업이 있는지 확인하여 NEW 태그 표시 */}
              {document.tasks?.some(task =>
                task.assignedUserEmail === currentUser?.email && task.isNew
              ) && (
                <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded">
                  NEW
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-14 shrink-0">생성일</span>
                <span className="text-gray-900 font-medium truncate">{formatKoreanFullDateTime(document.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 w-14 shrink-0">수정일</span>
                <span className="text-gray-900 font-medium truncate">{formatKoreanFullDateTime(document.updatedAt || document.createdAt)}</span>
              </div>
              {document.status === 'COMPLETED' && document.statusLogs && (() => {
                const completedLog = document.statusLogs
                  .filter(log => log.status === 'COMPLETED')
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                return completedLog ? (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-14 shrink-0">완료일</span>
                    <span className="text-green-600 font-medium truncate">{formatKoreanFullDateTime(completedLog.timestamp)}</span>
                  </div>
                ) : null;
              })()}
              {document.deadline && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-14 shrink-0">마감일</span>
                  <span
                    className={`truncate ${
                      new Date(document.deadline) < new Date() && document.status !== DOCUMENT_STATUS.COMPLETED
                        ? 'text-red-600 font-medium'
                        : 'text-orange-600'
                    }`}
                  >
                    {formatKoreanFullDateTime(document.deadline as string)}
                  </span>
                </div>
              )}
              {(() => {
                const roleInfo = getRoleAssignmentMessage(document, currentUser?.email || '');
                return roleInfo ? (
                  <div className={`flex items-center gap-1 font-medium ${
                    document.status === 'REVIEWING' 
                      ? 'text-orange-600' 
                      : 'text-blue-600'
                  }`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="truncate">{roleInfo.label}: {roleInfo.time}</span>
                  </div>
                ) : null;
              })()}
            </div>

            {/* 담당자 정보 표시 */}
            {showAssigneeInfo && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                  {(() => {
                    const assignees = getTaskAssignees(document);
                    return (
                      <>
                        {renderAssigneeInfo(assignees.editor, '작성자', 'bg-blue-500')}
                        {renderAssigneeInfo(assignees.signer, '서명자', 'bg-blue-500')}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        <div className="flex items-center space-x-2">
          {!showCheckbox && (
            <>{renderActionButton()}</>
          )}

          <button
            onClick={() => onWorkflow(document)}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {showCheckbox ? '작업현황' : '문서현황'}
          </button>

          <button
            onClick={() => onPreview(document.id)}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            미리보기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentListItem;