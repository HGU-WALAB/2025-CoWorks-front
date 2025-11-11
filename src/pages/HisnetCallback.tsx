import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const HisnetCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hisnetLogin, refreshUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleHisnetCallback = async () => {
      try {
        // URL에서 token 파라미터 추출
        const hisnetToken = searchParams.get('token');
        
        if (!hisnetToken) {
          setError('히즈넷 토큰이 없습니다.');
          setLoading(false);
          return;
        }

        console.log('Hisnet token received:', hisnetToken);

        // authStore의 hisnetLogin 함수 사용
        await hisnetLogin(hisnetToken);
        
        // 로그인 성공 후 최신 사용자 정보 가져오기
        await refreshUser();

        // 성공 시 메인 페이지로 리다이렉트
        navigate('/tasks');

      } catch (error: unknown) {
        console.error('Hisnet login error:', error);
        
        let errorMessage = '히즈넷 로그인에 실패했습니다.';
        if (error instanceof Error && 'response' in error && error.response && 
            typeof error.response === 'object' && 'data' in error.response && 
            error.response.data && typeof error.response.data === 'object') {
          const responseData = error.response.data as { error?: string; message?: string };
          errorMessage = responseData.error || responseData.message || errorMessage;
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };

    handleHisnetCallback();
  }, [searchParams, navigate, hisnetLogin, refreshUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">
                히즈넷 로그인 처리 중...
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                잠시만 기다려주세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">
                로그인 실패
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                {error}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  로그인 페이지로 돌아가기
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default HisnetCallback;
