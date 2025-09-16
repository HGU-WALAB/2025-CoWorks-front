import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import TemplateList from './pages/TemplateList';
import TemplateUpload from './pages/TemplateUpload';
import DocumentList from './pages/DocumentList';
import DocumentEditor from './pages/DocumentEditor.tsx';
import DocumentReview from './pages/DocumentReview';
import DocumentNew from './pages/DocumentNew';
import TaskDashboard from './pages/TaskDashboard';
import FolderPage from './pages/FolderPage';
import Login from './pages/Login';
import Signup from './pages/Signup';
import HisnetCallback from './pages/HisnetCallback';
import { useAuthStore } from './stores/authStore';

// 인증이 필요한 페이지들을 감싸는 컴포넌트
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const { initialize } = useAuthStore();

  // 앱 시작 시 저장된 토큰 복원 및 Authorization 헤더 설정
  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Router>
      <Routes>
        {/* 공개 라우트 */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/hiswork/callback" element={<HisnetCallback />} />
        
        {/* 보호된 라우트 */}
        <Route path="/" element={<Navigate to="/tasks" replace />} />
        <Route 
          path="/tasks" 
          element={
            <ProtectedRoute>
              <Layout>
                <TaskDashboard />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/templates" 
          element={
            <ProtectedRoute>
              <Layout>
                <TemplateList />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/templates/pdf/upload" 
          element={
            <ProtectedRoute>
              <Layout>
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
              <Layout>
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
              <DocumentEditor />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/documents/:id/edit" 
          element={
            <ProtectedRoute>
              <DocumentEditor />
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
          path="/folders" 
          element={
            <ProtectedRoute>
              <Layout>
                <FolderPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/folders/:folderId" 
          element={
            <ProtectedRoute>
              <Layout>
                <FolderPage />
              </Layout>
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
