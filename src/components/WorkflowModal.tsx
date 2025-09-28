import React from 'react';
import { Document, DocumentStatusLog } from '../types/document';

interface WorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
}

// 워크플로우 단계 정의
const getWorkflowSteps = () => {
  return [
    { key: 'EDITING', label: '편집중', description: '문서 내용 편집 및 수정' },
    { key: 'READY_FOR_REVIEW', label: '서명자 지정', description: '서명자 지정 및 설정' },
    { key: 'REVIEWING', label: '검토중', description: '검토자가 문서 검토' },
    { key: 'COMPLETED', label: '완료', description: '모든 작업 완료' }
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

const WorkflowModal: React.FC<WorkflowModalProps> = ({ isOpen, onClose, document }) => {
  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-800">문서 현황</h2>
            <p className="text-sm text-gray-600 mt-1">
              {document.title}
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
          <div className="flex justify-center py-8">
            <div className="flex items-start max-w-4xl w-full px-8">
              {getWorkflowSteps().map((step, index) => {
                const currentIndex = getCurrentStepIndex(document.status);
                const isCompleted = document.status === 'COMPLETED' 
                  ? index <= currentIndex  // COMPLETED 상태일 때는 해당 단계까지 모두 완료로 표시
                  : index < currentIndex;
                const isActive = document.status !== 'COMPLETED' && index === currentIndex;
                const isLastStep = index === getWorkflowSteps().length - 1;

                return (
                  <React.Fragment key={step.key}>
                    {/* Step Circle and Content */}
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-medium text-sm mb-2 ${
                        isCompleted
                          ? 'bg-green-500 text-white border-green-500'
                          : isActive
                          ? 'bg-blue-500 text-white border-blue-500'
                          : 'bg-gray-200 text-gray-500 border-gray-300'
                      }`}>
                        {isCompleted ? '✓' : index + 1}
                      </div>

                      <div className="h-[100px] flex flex-col justify-start items-center">
                        <div className={`font-medium text-sm mb-1 text-center ${
                          isCompleted || isActive
                            ? 'text-gray-900'
                            : 'text-gray-500'
                        }`}>
                          {step.label}
                        </div>
                        <div className={`text-xs text-center px-2 mb-2 ${
                          isCompleted || isActive
                            ? 'text-gray-600'
                            : 'text-gray-400'
                        }`}>
                          {step.description}
                        </div>

                        {/* 상태 표시 - 고정된 높이 영역 */}
                        <div className="h-12 flex flex-col items-center justify-center">
                          {isActive && (
                            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full mb-1">
                              진행중
                            </span>
                          )}
                          {isCompleted && (
                            <>
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full mb-1">
                                완료
                              </span>
                              {(() => {
                                const completionTime = getStatusCompletionTime(document.statusLogs, step.key);
                                return completionTime && (
                                  <div className="text-xs text-gray-500 text-center">
                                    {completionTime}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Connector Line */}
                    {!isLastStep && (
                      <div className="flex-1 flex items-center justify-center mx-6" style={{ marginTop: '20px' }}>
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
        </div>
      </div>
    </div>
  );
};

export default WorkflowModal;