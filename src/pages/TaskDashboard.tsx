import React from 'react';
import { useAuthStore } from '../stores/authStore';
import StaffDashboard from './StaffDashboard';
import UserDashboard from './UserDashboard';

const TaskDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const isStaff = user?.position === '교직원';

  // 교직원이면 StaffDashboard, 아니면 UserDashboard 렌더링
  if (isStaff) {
    return <StaffDashboard />;
  }

  return <UserDashboard />;
};

export default TaskDashboard;
