import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import StaffDashboard from './StaffDashboard';
import UserDashboard from './UserDashboard';

const TaskDashboard: React.FC = () => {
  const { user, isAuthenticated, refreshUser } = useAuthStore();

  // 로그인 상태이고 user가 없거나 position이 없을 때 refreshUser 호출
  useEffect(() => {
    if (isAuthenticated && (!user || !user.position)) {
      console.log('TaskDashboard: User or position missing, refreshing user...');
      refreshUser();
    }
  }, [isAuthenticated, user, refreshUser]);

  // 로딩 중이거나 user 정보가 아직 없는 경우
  if (isAuthenticated && (!user || !user.position)) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">사용자 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const isStaff = user?.position === '교직원';

  // 교직원이면 StaffDashboard, 아니면 UserDashboard 렌더링
  if (isStaff) {
    return <StaffDashboard />;
  }

  return <UserDashboard />;
};

export default TaskDashboard;
