import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AccessDeniedProps } from '../types/folder';

const AccessDenied: React.FC<AccessDeniedProps> = ({ onGoHome }) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* 에러 아이콘 */}
          <div className="mx-auto h-24 w-24 text-red-500 mb-4">
            <svg
              className="w-full h-full"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          {/* 제목 */}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            접근 권한이 없습니다
          </h2>
          
          {/* 설명 */}
          <p className="mt-2 text-sm text-gray-600">
            폴더 기능을 사용하려면 관리자에게 권한을 요청하세요.
          </p>
        </div>
        
        {/* 액션 버튼 */}
        <div className="mt-8">
          <button
            onClick={handleGoHome}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg
                className="h-5 w-5 text-indigo-500 group-hover:text-indigo-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414-1.414L9 5.586 7.707 4.293a1 1 0 00-1.414 1.414L8.586 8l-2.293 2.293a1 1 0 101.414 1.414L9 10.414l1.293 1.293a1 1 0 001.414-1.414L10.414 9l2.293-2.293a1 1 0 000-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
            홈으로 돌아가기
          </button>
        </div>
        
        {/* 추가 안내 */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            문의사항이 있으시면 시스템 관리자에게 연락하세요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;