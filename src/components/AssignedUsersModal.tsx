import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

interface AssignedUser {
  studentId?: number;
  name: string;
  email: string;
  userStatus: 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN';
}

interface AssignedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: number;
  templateName: string;
}

const AssignedUsersModal: React.FC<AssignedUsersModalProps> = ({
  isOpen,
  onClose,
  templateId,
  templateName,
}) => {
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignedUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1단계: templateId로 stagingId 목록 조회
      const stagingResponse = await axios.get(
        `${API_BASE_URL}/documents/bulk/getStaging?templateId=${templateId}`
      );
      
      // 백엔드에서 stagingId만 반환 (문자열 또는 문자열 배열)
      let stagingIds: string[] = [];
      
      if (typeof stagingResponse.data === 'string') {
        // 단일 stagingId인 경우
        stagingIds = [stagingResponse.data];
      } else if (Array.isArray(stagingResponse.data)) {
        // stagingId 배열인 경우
        stagingIds = stagingResponse.data;
      } else if (stagingResponse.data && typeof stagingResponse.data === 'object') {
        // 객체 형태로 반환되는 경우 (예: { stagingIds: [...] })
        stagingIds = stagingResponse.data.stagingIds || stagingResponse.data.data || [];
      }
      
      if (!stagingIds || stagingIds.length === 0) {
        setAssignedUsers([]);
        setLoading(false);
        return;
      }
      
      // 2단계: 각 stagingId로 items 조회하여 병합
      const allUsers: AssignedUser[] = [];
      
      for (const stagingId of stagingIds) {
        try {
          const itemsResponse = await axios.get(
            `${API_BASE_URL}/documents/bulk/staging/${stagingId}/items`
          );
          
          const items = itemsResponse.data.items || [];
          console.log('Raw items from API:', items); // 디버깅용 로그
          
          const users: AssignedUser[] = items.map((item: { 
            id?: number;
            studentId?: number;
            name?: string; 
            studentName?: string; 
            email?: string; 
            studentEmail?: string; 
            userStatus?: unknown 
          }) => {
            const user = {
              studentId: item.id || item.studentId, // id 또는 userId 필드 확인
              name: item.name || item.studentName || '',
              email: item.email || item.studentEmail || '',
              userStatus: normalizeStatus(item.userStatus),
            };
            console.log('Mapped user:', user); // 디버깅용 로그
            return user;
          });
          
          allUsers.push(...users);
        } catch (itemErr) {
          console.error(`Failed to fetch items for staging ${stagingId}:`, itemErr);
          // 개별 staging 조회 실패는 무시하고 계속 진행
        }
      }
      
      // 중복 제거 (같은 이메일)
      const uniqueUsers = allUsers.filter((user, index, self) =>
        index === self.findIndex((u) => u.email === user.email)
      );
      
      setAssignedUsers(uniqueUsers);
    } catch (err: unknown) {
      console.error('Failed to fetch assigned users:', err);
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '할당된 사용자 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (isOpen) {
      fetchAssignedUsers();
    }
  }, [isOpen, fetchAssignedUsers]);

  const normalizeStatus = (status: unknown): AssignedUser['userStatus'] => {
    return status === 'REGISTERED' || status === 'UNREGISTERED' ? status : 'UNKNOWN';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* 배경 오버레이 */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* 모달 중앙 정렬을 위한 트릭 */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        {/* 모달 컨텐츠 */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    할당된 사용자 목록
                  </h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-500">템플릿: <span className="font-medium">{templateName}</span></p>
                </div>

                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : error ? (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-red-800 text-sm">{error}</p>
                  </div>
                ) : assignedUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">할당된 사용자 없음</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      이 템플릿으로 생성된 할당 문서가 없습니다.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="mb-2 text-sm text-gray-700">
                      총 <span className="font-semibold text-blue-600">{assignedUsers.length}명</span>의 사용자에게 할당되었습니다.
                    </div>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {assignedUsers.map((user, index) => (
                        <div
                          key={`${user.email}-${index}`}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                              {user.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="font-semibold text-gray-900 text-base">
                                  {user.name || '이름 없음'}
                                </div>
                                <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-full">
                                  학번: {user.studentId|| 'N/A'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600">
                                {user.email || '이메일 없음'}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <span
                              className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                user.userStatus === 'REGISTERED'
                                  ? 'bg-green-100 text-green-800'
                                  : user.userStatus === 'UNREGISTERED'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {user.userStatus === 'REGISTERED'
                                ? '문서 할당 됨'
                                : user.userStatus === 'UNREGISTERED'
                                ? '회원가입 필요한 유저'
                                : '상태 불명'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignedUsersModal;

