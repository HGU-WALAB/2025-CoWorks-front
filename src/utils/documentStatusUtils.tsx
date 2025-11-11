import React from 'react';

export interface DocumentStatus {
  DRAFT: string;
  EDITING: string;
  READY_FOR_REVIEW: string;
  REVIEWING: string;
  SIGNING: string;
  COMPLETED: string;
  REJECTED: string;
}

export interface StatusConfig {
  color: string;
  text: string;
  description?: string;
}

export const DOCUMENT_STATUS: DocumentStatus = {
  DRAFT: 'DRAFT',
  EDITING: 'EDITING',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  REVIEWING: 'REVIEWING',
  SIGNING: 'SIGNING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED'
};

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  [DOCUMENT_STATUS.DRAFT]: {
    color: 'bg-gray-100 text-gray-800',
    text: '초안',
    description: '문서가 임시 저장된 상태입니다'
  },
  [DOCUMENT_STATUS.EDITING]: {
    color: 'bg-blue-100 text-blue-800',
    text: '작성중',
    description: '현재 문서를 작성하고 있습니다'
  },
  [DOCUMENT_STATUS.READY_FOR_REVIEW]: {
    color: 'bg-purple-100 text-purple-800',
    text: '서명자 지정',
    description: '검토자 지정을 기다리고 있습니다'
  },
  [DOCUMENT_STATUS.REVIEWING]: {
    color: 'bg-yellow-100 text-yellow-800',
    text: '검토중',
    description: '검토자가 문서를 검토하고 있습니다'
  },
  [DOCUMENT_STATUS.SIGNING]: {
    color: 'bg-orange-100 text-orange-800',
    text: '서명중',
    description: '서명자가 문서에 서명하고 있습니다'
  },
  [DOCUMENT_STATUS.COMPLETED]: {
    color: 'bg-green-100 text-green-800',
    text: '완료',
    description: '문서 작업이 완료되었습니다'
  },
  [DOCUMENT_STATUS.REJECTED]: {
    color: 'bg-red-100 text-red-800',
    text: '반려',
    description: '문서가 반려되어 수정이 필요합니다'
  }
};


export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  showDescription?: boolean;
  className?: string;
  isRejected?: boolean;
  rejectComment?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDescription = false,
  className = '',
  isRejected = false,
  rejectComment
}) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[DOCUMENT_STATUS.DRAFT];

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const sizeClass = sizeClasses[size];

  // isRejected가 true이고 현재 상태가 REJECTED가 아닌 경우 "<반려>" 접두사 추가
  const showRejectPrefix = isRejected && status !== DOCUMENT_STATUS.REJECTED;

  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full font-medium ${config.color} ${sizeClass} ${className}`}>
        {showRejectPrefix && <span>&lt;반려&gt; </span>}
        {config.text}
      </span>
      {showRejectPrefix && rejectComment && (
        <span className="text-sm text-red-400 font-bold">
          반려 사유: {rejectComment}
        </span>
      )}
      {showDescription && (
        <span className="text-sm text-gray-500">
          {config.description}
        </span>
      )}
    </div>
  );
};

export const getStatusConfig = (status: string): StatusConfig => {
  return STATUS_CONFIG[status] || STATUS_CONFIG[DOCUMENT_STATUS.DRAFT];
};

export const getStatusText = (status: string, isRejected?: boolean): string => {
  const text = getStatusConfig(status).text;
  // isRejected가 true이고 현재 상태가 REJECTED가 아닌 경우 "<반려>" 접두사 추가
  return (isRejected && status !== DOCUMENT_STATUS.REJECTED)
    ? `<반려> ${text}`
    : text;
};

export const getStatusColor = (status: string): string => {
  return getStatusConfig(status).color;
};

// 페이지별 특화된 상태 표시
export interface PageStatusHeaderProps {
  title: string;
  status: string;
  subtitle?: string;
}

export const PageStatusHeader: React.FC<PageStatusHeaderProps> = ({
  title,
  status,
  subtitle
}) => {
  return (
    <div className="flex items-center gap-3">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <StatusBadge status={status} size="md" />
      {subtitle && (
        <span className="text-sm text-gray-500">• {subtitle}</span>
      )}
    </div>
  );
};