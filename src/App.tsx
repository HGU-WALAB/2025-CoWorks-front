import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import TemplateList from './pages/TemplateList';
import TemplateUpload from './pages/TemplateUpload';
import DocumentList from './pages/DocumentList';
import DocumentEditor from './pages/DocumentEditor.tsx';
import DocumentReview from './pages/DocumentReview';
import DocumentSignerAssignment from './pages/DocumentSignerAssignment';
import DocumentSign from './pages/DocumentSign';
import DocumentSignStandalone from './pages/DocumentSignStandalone';
import DocumentCompleted from './pages/DocumentCompleted';
import DocumentNew from './pages/DocumentNew';
import TaskDashboard from './pages/TaskDashboard';
import ReviewDashboard from './pages/ReviewDashboard';
import FolderPage from './pages/FolderPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import HisnetCallback from './pages/HisnetCallback';
import ServiceTerms from './pages/Policy/ServiceTerms';
import PrivacyPolicy from './pages/Policy/PrivacyPolicy';
import { useAuthStore } from './stores/authStore';

// 인증이 필요한 페이지들을 감싸는 컴포넌트
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// position에 따라 홈 경로를 결정하는 컴포넌트
const HomeRedirect: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  // 사용자 정보가 로드 중인 경우 대기
  if (!user || !user.position) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }
  
  if (user.position === '교직원') {
    return <Navigate to="/folders" replace />;
  }
  
  return <Navigate to="/tasks" replace />;
};

// position에 따라 /tasks 접근 시 리다이렉트하는 컴포넌트
const TasksRedirect: React.FC = () => {
  return (
    <ProtectedRoute>
      <Layout showFooter>
        <TaskDashboard />
      </Layout>
    </ProtectedRoute>
  );
};

function App() {
  const { initialize, refreshUser } = useAuthStore();
  const [isInitialized, setIsInitialized] = React.useState(false);

  // 앱 시작 시 저장된 토큰 복원 및 사용자 정보 로드
  useEffect(() => {
    const initApp = async () => {
      // 1. 토큰 복원 및 Authorization 헤더 설정
      initialize();
      
      // 2. 인증된 상태라면 사용자 정보 새로고침
      const state = useAuthStore.getState();
      if (state.isAuthenticated) {
        await refreshUser();
      }
      
      // 3. 초기화 완료
      setIsInitialized(true);
    };
    
    initApp();
  }, [initialize, refreshUser]);

  // 초기화가 완료될 때까지 로딩 표시
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/hiswork/callback" element={<HisnetCallback />} />
        
        {/* 보호된 라우트 */}
        <Route path="/" element={<HomeRedirect />} />
        <Route 
          path="/tasks" 
          element={<TasksRedirect />}
        />
        <Route 
          path="/review" 
          element={
            <ProtectedRoute>
              <Layout>
                <ReviewDashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/templates" 
          element={
            <ProtectedRoute>
              <Layout showFooter>
                <TemplateList />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/templates/pdf/upload" 
          element={
            <ProtectedRoute>
              <Layout showFooter>
                <TemplateUpload />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/templates/edit/:id" 
          element={
            <ProtectedRoute>
              <Layout>
                <TemplateUpload />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents" 
          element={
            <ProtectedRoute>
              <Layout showFooter>
                <DocumentList />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents/new" 
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentNew />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route
          path="/documents/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentEditor />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentEditor />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route 
          path="/documents/:id/review" 
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentReview />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents/:id/signer-assignment" 
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentSignerAssignment />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents/:id/sign" 
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentSign />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents/:id/completed" 
          element={
            <ProtectedRoute>
              <Layout>
                <DocumentCompleted />
              </Layout>
            </ProtectedRoute>
          } 
        />
        {/* 이메일 링크 전용 서명 페이지 - Layout 없이 독립적으로 동작 */}
        <Route 
          path="/email-sign/:id" 
          element={
            <ProtectedRoute>
              <DocumentSignStandalone />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/folders" 
          element={
            <ProtectedRoute>
              <Layout showFooter>
                <FolderPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/folders/:folderId" 
          element={
            <ProtectedRoute>
              <Layout showFooter>
                <FolderPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/policy/service" 
          element={
            <Layout>
              <ServiceTerms />
            </Layout>
          } 
        />
        <Route 
          path="/policy/privacy" 
          element={
            <Layout>
              <PrivacyPolicy />
            </Layout>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
