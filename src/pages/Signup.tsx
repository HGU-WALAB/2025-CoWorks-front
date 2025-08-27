import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore, type SignupRequest } from '../stores/authStore';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup, loading, error, clearError, isAuthenticated } = useAuthStore();

  const [formData, setFormData] = useState<SignupRequest>({
    email: '',
    password: '',
    name: '',
    position: '',
  });

  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/tasks');
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 유효성 검사
    if (!formData.email.trim() || !formData.password.trim() || 
        !formData.name.trim() || !formData.position.trim()) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    if (formData.password.length < 4) {
      alert('비밀번호는 최소 4자 이상이어야 합니다.');
      return;
    }

    if (formData.password !== confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 간단한 이메일 형식 검사 (정규표현식 사용하지 않음)
    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      alert('올바른 이메일 형식을 입력해주세요.');
      return;
    }

    try {
      await signup(formData);
      navigate('/tasks');
    } catch (error) {
      // 에러는 store에서 처리됨
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">HisWork</h1>
          <h2 className="text-2xl font-bold text-gray-900">회원가입</h2>
          <p className="mt-2 text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일 *
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                  placeholder="example@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                이름 *
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="input"
                  placeholder="홍길동"
                />
              </div>
            </div>

            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700">
                직분 *
              </label>
              <div className="mt-1">
                <select
                  id="position"
                  name="position"
                  required
                  value={formData.position}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="">직분을 선택하세요</option>
                  <option value="교직원">교직원</option>
                  <option value="교수">교수</option>
                  <option value="학생">학생</option>
                  <option value="연구원">연구원</option>
                  <option value="행정직원">행정직원</option>
                  <option value="기타">기타</option>
                </select>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                현재 직분을 선택해주세요.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호 *
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input"
                  placeholder="최소 4자 이상"
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                비밀번호 확인 *
              </label>
              <div className="mt-1">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  placeholder="비밀번호를 다시 입력하세요"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary"
              >
                {loading ? '가입 중...' : '회원가입'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">또는</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/"
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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

export default Signup; 