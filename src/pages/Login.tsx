import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { error, clearError, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/tasks');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleHisnetLogin = () => {
    const hisnetLoginUrl = import.meta.env.VITE_HISNET_LOGIN_URL;
    if (hisnetLoginUrl) {
      window.location.href = hisnetLoginUrl;
    } else {
      alert('히즈넷 로그인 URL이 설정되지 않았습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">CoWorks</h1>
          <h2 className="text-2xl font-bold text-gray-900">히즈넷 로그인</h2>
          <p className="mt-2 text-sm text-gray-600">
            CoWorks는 히즈넷 계정을 통해서만 로그인할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <p className="text-sm text-gray-600 leading-6 text-center">
              아래 버튼을 눌러 히즈넷 인증을 진행해주세요. 인증이 완료되면 자동으로 CoWorks로 돌아옵니다.
            </p>

            <button
              onClick={handleHisnetLogin}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-blue-300 rounded-md shadow-sm bg-blue-50 text-base font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
            >
              히즈넷 로그인
            </button>

            <div className="pt-4 border-t border-gray-200">
              <Link
                to="/"
                className="w-full flex justify-center py-2.5 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                메인 페이지로 돌아가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;