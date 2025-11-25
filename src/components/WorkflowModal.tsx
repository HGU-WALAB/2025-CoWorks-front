import React from 'react';
import { Document, DocumentStatusLog, TaskInfo } from '../types/document';

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

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
  if (!isOpen || !doc) return null;

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

  return (
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
          <button
            onClick={onClose}
            className="btn btn-primary text-sm"
          >
            닫기
          </button>
        </div>
        <div className="p-6">
          {/* Horizontal Stepper */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="flex items-start max-w-4xl w-full px-4">
              {getWorkflowSteps().map((step, index) => {
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
                    {task.lastViewedAt && (
                      <div className="text-xs text-gray-500">
                        {new Date(task.lastViewedAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
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
                    {task.lastViewedAt && (
                      <div className="text-xs text-gray-500">
                        {new Date(task.lastViewedAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
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
                    {task.lastViewedAt && (
                      <div className="text-xs text-gray-500">
                        {new Date(task.lastViewedAt).toLocaleString('ko-KR', {
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowModal;