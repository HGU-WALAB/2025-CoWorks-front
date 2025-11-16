import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { error, clearError, isAuthenticated, login, loading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login) return;
    try {
      await login({ email, password });
    } catch (e) {
      // store sets error; no local handling needed
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

            {import.meta.env.DEV && (
              <form onSubmit={handleDevLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">이메일</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="dev@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">비밀번호</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="password"
                  />
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-base font-semibold text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {loading ? '로딩...' : '개발 이메일 로그인'}
                  </button>
                </div>

                <p className="text-xs text-gray-500">(개발 환경에서만 보입니다)</p>
              </form>
            )}

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