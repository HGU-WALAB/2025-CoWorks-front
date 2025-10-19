import { Document } from '../types/document';

/**
 * 문서 상태에 따라 적절한 역할 지정 시간 메시지를 반환합니다.
 * EDITING 상태면 편집자 할당 시간, REVIEWING 상태면 서명자 할당 시간을 표시합니다.
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
    label = '편집자로 지정된 시간';
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

  // 한국어 형식으로 날짜 포매팅
  const date = new Date(userTask.createdAt);
  const formattedTime = date.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return { label, time: formattedTime };
};

/**
 * 짧은 형식의 역할 지정 시간 메시지를 반환합니다.
 * 문서 상태에 따라 EDITING이면 편집자 할당 시간, REVIEWING이면 서명자 할당 시간을 표시합니다.
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
    label = '편집자 지정';
  } else if (document.status === 'REVIEWING') {
    targetRole = 'REVIEWER';
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

  const date = new Date(userTask.createdAt);
  const formattedTime = date.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  return { label, time: formattedTime };
};

