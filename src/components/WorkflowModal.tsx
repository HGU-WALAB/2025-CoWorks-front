import React, { useState } from 'react';
import { Document, DocumentStatusLog, TaskInfo } from '../types/document';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import DocumentPreviewModal from './DocumentPreviewModal';
import { loadPdfPagesFromTemplate } from '../utils/pdfPageLoader';

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

interface EmailComposerProps {
  recipientName: string;
  recipientEmail: string;
  onClose: () => void;
  onSend: (message: string) => void;
}

const EmailComposer: React.FC<EmailComposerProps> = ({ recipientName, recipientEmail, onClose, onSend }) => {
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) {
      alert('메시지를 입력해주세요.');
      return;
    }
    onSend(message);
    setMessage('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">메일 보내기</h3>
          <p className="text-sm text-gray-600 mt-1">
            받는 사람: {recipientName} ({recipientEmail})
          </p>
        </div>
        <div className="p-6">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="메시지를 입력하세요..."
            className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSend}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
};

// 워크플로우 단계 정의 (role과 매핑)
const getWorkflowSteps = () => {
  return [
    { 
      key: 'EDITING', 
      label: '작성중', 
      roles: ['EDITOR']
    },
    { 
      key: 'REVIEWING', 
      label: '검토중',
      roles: ['REVIEWER']
    },
    { 
      key: 'SIGNING', 
      label: '서명중',
      roles: ['SIGNER']
    },
    { 
      key: 'COMPLETED', 
      label: '완료', 
      roles: []
    }
  ];
};

// 현재 단계 인덱스 가져오기
const getCurrentStepIndex = (status: string) => {
  const steps = getWorkflowSteps();
  const currentIndex = steps.findIndex(step => step.key === status);
  return currentIndex >= 0 ? currentIndex : 0;
};

// 반려된 문서인지 확인하는 함수 (EDITING 상태이면서 반려된 경우만)
const isRejectedDocument = (doc: Document | null): boolean => {
  if (!doc) return false;
  return doc.status === 'EDITING' && doc.isRejected === true;
};

// 반려 정보를 가져오는 함수
const getRejectionInfo = (statusLogs: DocumentStatusLog[] | undefined): { time: string; comment: string; rejectedBy: string } | null => {
  if (!statusLogs) return null;
  
  // rejectLog가 true인 로그를 우선적으로 찾고, 없으면 REJECTED 상태의 로그를 찾음
  const rejectedLog = statusLogs
    .filter(log => log.rejectLog === true || log.status === 'REJECTED')
    .sort((a, b) => {
      // rejectLog가 true인 로그를 우선순위로 정렬
      if (a.rejectLog === true && b.rejectLog !== true) return -1;
      if (a.rejectLog !== true && b.rejectLog === true) return 1;
      // 같은 우선순위면 최신순으로 정렬
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })[0];
  
  if (rejectedLog) {
    return {
      time: new Date(rejectedLog.timestamp).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }),
      comment: rejectedLog.comment || '사유 없음',
      rejectedBy: rejectedLog.changedByName || rejectedLog.changedByEmail || '알 수 없음'
    };
  }
  
  return null;
};

// 특정 상태의 완료 시간을 가져오는 함수
const getStatusCompletionTime = (statusLogs: DocumentStatusLog[] | undefined, status: string): string | null => {
  if (!statusLogs) return null;
  
  const statusLog = statusLogs.find(log => log.status === status);
  if (statusLog?.timestamp) {
    return new Date(statusLog.timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }
  return null;
};

// 해당 단계의 담당자들을 가져오는 함수
const getAssignedUsers = (tasks: TaskInfo[] | undefined, roles: string[]) => {
  if (!tasks || roles.length === 0) return [];
  
  return tasks.filter(task => roles.includes(task.role));
};

const WorkflowModal: React.FC<WorkflowModalProps> = ({ isOpen, onClose, document: doc }) => {
  const { user: currentUser } = useAuthStore();
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<{ name: string; email: string } | null>(null);
  
  // 미리보기 모달 상태
  const [showPreview, setShowPreview] = useState(false);
  const [coordinateFields, setCoordinateFields] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);

  // ESC 키로 닫기
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.document.addEventListener('keydown', handleEscape);
    }

    return () => {
      window.document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 메일 전송 버튼 클릭 핸들러
  const handleEmailClick = (task: TaskInfo) => {
    setSelectedRecipient({
      name: task.assignedUserName,
      email: task.assignedUserEmail
    });
    setEmailComposerOpen(true);
  };

  // 메일 전송 핸들러
  const handleSendEmail = async (message: string) => {
    if (!doc || !selectedRecipient) return;

    try {
      const response = await axios.post(
        `${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.SEND_MESSAGE(doc.id)}`,
        {
          recipientEmail: selectedRecipient.email,
          message: message
        }
      );

      console.log('메일 전송 성공:', response.data);
      alert(`메일이 성공적으로 전송되었습니다.\n받는 사람: ${selectedRecipient.name}`);
    } catch (error: any) {
      console.error('메일 전송 실패:', error);
      console.error('에러 응답:', error.response?.data);
      console.error('에러 상태:', error.response?.status);
      
      const errorMessage = error.response?.data?.error || '메일 전송에 실패했습니다.';
      alert(`메일 전송 실패\n${errorMessage}\n\n다시 시도해주세요.`);
    }
  };

  // 미리보기 핸들러
  const handlePreview = () => {
    if (!doc) return;

    try {
      // 저장된 필드 데이터만 사용
      const savedFields = doc.data?.coordinateFields || [];
      setCoordinateFields(savedFields);

      // 서명 필드 처리
      const docSignatureFields = doc.data?.signatureFields || [];
      const docSignatures = doc.data?.signatures || {};

      const processedSignatureFields = docSignatureFields.map((field: any) => ({
        ...field,
        signatureData: docSignatures[field.reviewerEmail]
      }));

      setSignatureFields(processedSignatureFields);
      setShowPreview(true);
    } catch (error) {
      console.error('미리보기 오류:', error);
      alert('미리보기를 불러오는 중 오류가 발생했습니다.');
    }
  };

  // PDF 이미지 URL 생성 함수
  const getPdfImageUrl = (document: Document) => {
    if (!document.template?.pdfImagePath) {
      return '';
    }
    const filename = document.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    return `/uploads/pdf-templates/${filename}`;
  };

  // 여러 페이지 URL 배열 생성
  const getPdfImageUrls = (document: Document): string[] => {
    if (!document.template) return [];
    return loadPdfPagesFromTemplate(document.template);
  };

  if (!isOpen || !doc) return null;

  // 관리자 여부 확인 (position이 '교직원'인 경우)
  const isAdmin = currentUser?.position === '교직원';

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
      >
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-gray-800">문서 현황</h2>
              <p className="text-sm text-gray-600 mt-1">
                {doc.title}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreview}
                className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                미리보기
              </button>
              <button
                onClick={onClose}
                className="btn btn-primary text-sm"
              >
                닫기
              </button>
            </div>
          </div>
          <div className="p-6">
          {/* 반려 상태 알림 */}
          {isRejectedDocument(doc) && doc.status === 'EDITING' && getRejectionInfo(doc.statusLogs) && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="text-sm font-semibold text-red-800 mb-2">
                    반려된 문서
                  </h3>
                  <div className="text-sm text-red-700 space-y-1">
                    <p>
                      <span className="font-medium">반려자:</span> {getRejectionInfo(doc.statusLogs)?.rejectedBy}
                    </p>
                    <p>
                      <span className="font-medium">반려 시간:</span> {getRejectionInfo(doc.statusLogs)?.time}
                    </p>
                    <p>
                      <span className="font-medium">반려 사유:</span> {getRejectionInfo(doc.statusLogs)?.comment}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Horizontal Stepper */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="flex items-start max-w-4xl w-full px-4">
              {getWorkflowSteps().map((step, index) => {
                // 실제 문서 상태를 사용하여 표시
                const currentIndex = getCurrentStepIndex(doc.status);
                const isCompleted = doc.status === 'COMPLETED' 
                  ? index <= currentIndex  // COMPLETED 상태일 때는 해당 단계까지 모두 완료로 표시
                  : index < currentIndex;
                const isActive = doc.status !== 'COMPLETED' && index === currentIndex;
                const isLastStep = index === getWorkflowSteps().length - 1;

                return (
                  <React.Fragment key={step.key}>
                    {/* Step Circle and Content */}
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center font-semibold ${
                        isCompleted
                          ? 'bg-green-500 text-white border-green-500'
                          : isActive
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-gray-200 text-gray-500 border-gray-300'
                      }`}>
                        {isCompleted ? '✓' : index + 1}
                      </div>

                      <div className="mt-2 flex flex-col items-center min-w-[100px]">
                        <div className={`font-semibold mb-2 ${
                          isCompleted || isActive
                            ? 'text-gray-900'
                            : 'text-gray-500'
                        }`}>
                          {step.label}
                        </div>

                        {/* 상태 및 시간 표시 */}
                        {isActive && (
                          <span className="px-3 py-1 text-xs bg-blue-100 text-blue-800 rounded-full font-medium mb-2">
                            진행중
                          </span>
                        )}
                        {isCompleted && (
                          <>
                            <span className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-full font-medium mb-2">
                              완료
                            </span>
                            {(() => {
                              const completionTime = getStatusCompletionTime(doc.statusLogs, step.key);
                              return completionTime && (
                                <div className="text-xs text-gray-500">
                                  {completionTime}
                                </div>
                              );
                            })()}
                          </>
                        )}

                        {/* 담당자 표시 */}
                        {step.roles && step.roles.length > 0 && (
                          <div className="mt-2 flex flex-col items-center gap-1">
                            {getAssignedUsers(doc.tasks, step.roles).map((task, idx) => (
                              <div 
                                key={idx}
                                className="bg-gray-100 px-2 py-1 rounded text-xs text-gray-700 font-medium"
                                title={task.assignedUserEmail}
                              >
                                {task.assignedUserName}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Connector Line */}
                    {!isLastStep && (
                      <div className="flex-1 flex items-center justify-center mx-2" style={{ marginTop: '16px' }}>
                        <div className={`h-0.5 w-full ${
                          index < currentIndex
                            ? 'bg-green-500'
                            : index === currentIndex
                            ? 'bg-blue-500'
                            : 'bg-gray-300'
                        }`}></div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* 문서 작업자 상세 정보 섹션 */}
          {doc.tasks && doc.tasks.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">문서 작업자</h3>
              <div className="space-y-2">
                {/* 작성자 */}
                {doc.tasks.filter(task => task.role === 'EDITOR').map((task, idx) => (
                  <div key={`editor-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                        작성자
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{task.assignedUserName}</div>
                        <div className="text-xs text-gray-500">{task.assignedUserEmail}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 text-right">
                        <div className="font-medium text-gray-600 mb-0.5">최근 확인</div>
                        <div>
                          {task.lastViewedAt 
                            ? new Date(task.lastViewedAt).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '미확인'
                          }
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleEmailClick(task)}
                          disabled={currentUser?.email === task.assignedUserEmail}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            currentUser?.email === task.assignedUserEmail
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={currentUser?.email === task.assignedUserEmail ? '본인에게는 메일을 보낼 수 없습니다' : '메일 보내기'}
                        >
                          <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          메일
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* 검토자 */}
                {doc.tasks.filter(task => task.role === 'REVIEWER').map((task, idx) => (
                  <div key={`reviewer-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded font-medium">
                        검토자
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{task.assignedUserName}</div>
                        <div className="text-xs text-gray-500">{task.assignedUserEmail}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 text-right">
                        <div className="font-medium text-gray-600 mb-0.5">최근 확인</div>
                        <div>
                          {task.lastViewedAt 
                            ? new Date(task.lastViewedAt).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '미확인'
                          }
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleEmailClick(task)}
                          disabled={currentUser?.email === task.assignedUserEmail}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            currentUser?.email === task.assignedUserEmail
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={currentUser?.email === task.assignedUserEmail ? '본인에게는 메일을 보낼 수 없습니다' : '메일 보내기'}
                        >
                          <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          메일
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* 서명자 */}
                {doc.tasks.filter(task => task.role === 'SIGNER').map((task, idx) => (
                  <div key={`signer-${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium">
                        서명자
                      </span>
                      <div>
                        <div className="font-medium text-gray-900">{task.assignedUserName}</div>
                        <div className="text-xs text-gray-500">{task.assignedUserEmail}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 text-right">
                        <div className="font-medium text-gray-600 mb-0.5">최근 확인</div>
                        <div>
                          {task.lastViewedAt 
                            ? new Date(task.lastViewedAt).toLocaleString('ko-KR', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : '미확인'
                          }
                        </div>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleEmailClick(task)}
                          disabled={currentUser?.email === task.assignedUserEmail}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                            currentUser?.email === task.assignedUserEmail
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          title={currentUser?.email === task.assignedUserEmail ? '본인에게는 메일을 보낼 수 없습니다' : '메일 보내기'}
                        >
                          <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          메일
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* 메일 작성 모달 */}
    {emailComposerOpen && selectedRecipient && (
      <EmailComposer
        recipientName={selectedRecipient.name}
        recipientEmail={selectedRecipient.email}
        onClose={() => {
          setEmailComposerOpen(false);
          setSelectedRecipient(null);
        }}
        onSend={handleSendEmail}
      />
    )}

    {/* 미리보기 모달 */}
    {showPreview && doc && doc.template?.pdfImagePath && (
      <DocumentPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        pdfImageUrl={getPdfImageUrl(doc)}
        pdfImageUrls={getPdfImageUrls(doc)}
        coordinateFields={coordinateFields}
        signatureFields={signatureFields}
        documentTitle={doc.title || doc.templateName}
      />
    )}
  </>
  );
};

export default WorkflowModal;