import { Document } from '../types/document';

export const formatKoreanFullDateTime = (dateInput: string | number | Date): string => {
  const date = new Date(dateInput);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  // 오늘
  if (diffInDays === 0) {
    const HH = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');
    return `오늘 ${HH}:${MM}`;
  }
  
  // 어제
  if (diffInDays === 1) {
    const HH = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');
    return `어제 ${HH}:${MM}`;
  }
  
  // 일주일 이내
  if (diffInDays > 1 && diffInDays < 7) {
    return `${diffInDays}일 전`;
  }
  
  // 미래 날짜 (마감일 등)
  if (diffInDays < 0) {
    const futureDays = Math.abs(diffInDays);
    if (futureDays === 0) {
      const HH = String(date.getHours()).padStart(2, '0');
      const MM = String(date.getMinutes()).padStart(2, '0');
      return `오늘 ${HH}:${MM}`;
    }
    if (futureDays === 1) {
      return `내일`;
    }
    if (futureDays < 7) {
      return `${futureDays}일 후`;
    }
  }
  
  // 그 외 (일주일 이상)
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}년 ${mm}월 ${dd}일`;
};

export const formatKoreanShortDateTime = (dateInput: string | number | Date): string => {
  const date = new Date(dateInput);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const MM = String(date.getMinutes()).padStart(2, '0');
  return `${mm}월 ${dd}일 ${HH} : ${MM}`;
};

/**
 * 문서 상태에 따라 적절한 역할 지정 시간 메시지를 반환합니다.
 * EDITING 상태면 작성자 할당 시간, REVIEWING 상태면 서명자 할당 시간을 표시합니다.
 * @param document 문서 객체
 * @param userEmail 현재 사용자 이메일
 * @returns 역할 지정 시간 메시지 또는 null
 */
export const getRoleAssignmentMessage = (
  document: Document,
  userEmail: string
): { label: string; time: string } | null => {
  if (!document.tasks) return null;

  // 문서 상태에 따라 표시할 역할 결정
  let targetRole: string | null = null;
  let label: string = '';

  if (document.status === 'EDITING') {
    targetRole = 'EDITOR';
    label = '작성자로 지정된 시간';
  } else if (document.status === 'REVIEWING') {
    targetRole = 'REVIEWER';
    label = '서명자로 지정된 시간';
  } else {
    // 다른 상태의 경우 표시하지 않음
    return null;
  }

  // 해당 역할의 사용자 찾기
  const userTask = document.tasks.find(task => 
    task.assignedUserEmail === userEmail && task.role === targetRole
  );
  
  if (!userTask || !userTask.createdAt) return null;

  return { label, time: formatKoreanShortDateTime(userTask.createdAt) };
};

/**
 * 짧은 형식의 역할 지정 시간 메시지를 반환합니다.
 * 문서 상태에 따라 EDITING이면 작성자 할당 시간, REVIEWING이면 서명자 할당 시간을 표시합니다.
 * @param document 문서 객체
 * @param userEmail 현재 사용자 이메일
 * @returns 짧은 형식의 역할 지정 시간 메시지 또는 null
 */
export const getRoleAssignmentMessageShort = (
  document: Document,
  userEmail: string
): { label: string; time: string } | null => {
  if (!document.tasks) return null;

  // 문서 상태에 따라 표시할 역할 결정
  let targetRole: string | null = null;
  let label: string = '';

  if (document.status === 'EDITING') {
    targetRole = 'EDITOR';
    label = '작성자 지정';
  } else if (document.status === 'REVIEWING') {
    targetRole = 'REVIEWER';
    label = '검토자 지정';
  }
  else if (document.status === 'SIGNING') {
    targetRole = 'SIGNER';
    label = '서명자 지정';
  } else {
    // 다른 상태의 경우 표시하지 않음
    return null;
  }

  // 해당 역할의 사용자 찾기
  const userTask = document.tasks.find(task => 
    task.assignedUserEmail === userEmail && task.role === targetRole
  );
  
  if (!userTask || !userTask.createdAt) return null;

  return { label, time: formatKoreanShortDateTime(userTask.createdAt) };
};

