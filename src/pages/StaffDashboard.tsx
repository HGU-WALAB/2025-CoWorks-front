import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { useFolderStore } from '../stores/folderStore';
import { Document } from '../types/document';
import { Folder } from '../types/folder';
import WorkflowModal from '../components/WorkflowModal';

const StaffDashboard: React.FC = () => {
  const { documents, fetchDocuments, loading } = useDocumentStore();
  const { folders, loadFolderContents } = useFolderStore();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [selectedWorkflowDocument, setSelectedWorkflowDocument] = useState<Document | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
      loadFolderContents(null); // 루트 폴더 로드
    }
  }, [isAuthenticated, fetchDocuments, loadFolderContents]);

  // 폴더별 문서 통계
  const folderStats = useMemo(() => {
    const stats: Record<string, { total: number; completed: number; inProgress: number }> = {};
    
    documents.forEach(doc => {
      const folderId = doc.folderId || 'unclassified';
      if (!stats[folderId]) {
        stats[folderId] = { total: 0, completed: 0, inProgress: 0 };
      }
      stats[folderId].total++;
      if (doc.status === 'COMPLETED') {
        stats[folderId].completed++;
      } else {
        stats[folderId].inProgress++;
      }
    });
    
    return stats;
  }, [documents]);

  // 문서 상태별 통계
  const stats = useMemo(() => {
    return {
      total: documents.length,
      editing: documents.filter(doc => ['DRAFT', 'EDITING'].includes(doc.status) && !doc.isRejected).length,
      reviewing: documents.filter(doc => doc.status === 'REVIEWING').length,
      signing: documents.filter(doc => doc.status === 'SIGNING').length,
      completed: documents.filter(doc => doc.status === 'COMPLETED').length,
      rejected: documents.filter(doc => doc.isRejected && doc.status === 'EDITING').length
    };
  }, [documents]);

  // 작업현황 모달 핸들러
  const handleWorkflow = (document: Document) => {
    setSelectedWorkflowDocument(document);
    setShowWorkflowModal(true);
  };

  // 필터링된 문서 목록
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // 폴더 필터
    if (selectedFolder !== null) {
      if (selectedFolder === 'unclassified') {
        filtered = filtered.filter(doc => !doc.folderId);
      } else {
        filtered = filtered.filter(doc => doc.folderId === selectedFolder);
      }
    }

    // 상태 필터
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'REJECTED') {
        // 반려 필터: 작성중 + 반려된 문서만 표시
        filtered = filtered.filter(doc => doc.isRejected && doc.status === 'EDITING');
      } else {
        filtered = filtered.filter(doc => {
          if (statusFilter === 'EDITING') {
            // 작성중: DRAFT/EDITING 상태이면서 반려되지 않은 문서
            return ['DRAFT', 'EDITING'].includes(doc.status) && !doc.isRejected;
          } else if (statusFilter === 'COMPLETED') {
            return doc.status === 'COMPLETED';
          } else if (statusFilter === 'REVIEWING') {
            // 검토중: REVIEWING 상태인 모든 문서 (반려 여부 무관)
            return doc.status === 'REVIEWING';
          } else if (statusFilter === 'SIGNING') {
            // 서명중: SIGNING 상태인 모든 문서 (반려 여부 무관)
            return doc.status === 'SIGNING';
          }
          
          return false;
        });
      }
    }

    // 검색 필터
    if (searchQuery) {
      filtered = filtered.filter(doc => 
        doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.templateName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [documents, statusFilter, searchQuery, selectedFolder]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">로그인이 필요합니다</h2>
          <p className="text-gray-600">관리자 권한으로 로그인해주세요.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const getStatusDisplay = (doc: Document) => {
    // 반려는 EDITING 상태일 때만 표시
    if (doc.isRejected && doc.status === 'EDITING') {
      return { text: '반려', color: 'bg-red-100 text-red-800' };
    }
    switch (doc.status) {
      case 'EDITING':
        return { text: '작성중', color: 'bg-blue-100 text-blue-800' };
      case 'DRAFT':
        return { text: '초안', color: 'bg-gray-100 text-gray-800' };
      case 'REVIEWING':
        return { text: '검토중', color: 'bg-yellow-100 text-yellow-800' };
      case 'SIGNING':
        return { text: '서명중', color: 'bg-orange-100 text-orange-800' };
      case 'COMPLETED':
        return { text: '완료', color: 'bg-green-100 text-green-800' };
      default:
        return { text: doc.status, color: 'bg-gray-100 text-gray-800' };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${month}.${day} ${hours}:${minutes}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">문서 관리</h1>
          <p className="text-sm text-gray-600">전체 문서 현황을 확인하고 관리하세요</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`p-5 rounded-xl transition-all duration-200 ${
              statusFilter === 'ALL'
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105' 
                : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`text-3xl font-bold mb-1 ${
              statusFilter === 'ALL' ? 'text-white' : 'text-gray-900'
            }`}>{stats.total}</div>
            <div className={`text-xs font-medium ${
              statusFilter === 'ALL' ? 'text-primary-100' : 'text-gray-600'
            }`}>전체</div>
          </button>

          <button
            onClick={() => setStatusFilter('EDITING')}
            className={`p-5 rounded-xl transition-all duration-200 ${
              statusFilter === 'EDITING' 
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105' 
                : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`text-3xl font-bold mb-1 ${
              statusFilter === 'EDITING' ? 'text-white' : 'text-gray-900'
            }`}>{stats.editing}</div>
            <div className={`text-xs font-medium ${
              statusFilter === 'EDITING' ? 'text-primary-100' : 'text-gray-600'
            }`}>작성중</div>
          </button>

          <button
            onClick={() => setStatusFilter('REVIEWING')}
            className={`p-5 rounded-xl transition-all duration-200 ${
              statusFilter === 'REVIEWING' 
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105' 
                : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`text-3xl font-bold mb-1 ${
              statusFilter === 'REVIEWING' ? 'text-white' : 'text-gray-900'
            }`}>{stats.reviewing}</div>
            <div className={`text-xs font-medium ${
              statusFilter === 'REVIEWING' ? 'text-primary-100' : 'text-gray-600'
            }`}>검토중</div>
          </button>

          <button
            onClick={() => setStatusFilter('SIGNING')}
            className={`p-5 rounded-xl transition-all duration-200 ${
              statusFilter === 'SIGNING' 
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105' 
                : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`text-3xl font-bold mb-1 ${
              statusFilter === 'SIGNING' ? 'text-white' : 'text-gray-900'
            }`}>{stats.signing}</div>
            <div className={`text-xs font-medium ${
              statusFilter === 'SIGNING' ? 'text-primary-100' : 'text-gray-600'
            }`}>서명중</div>
          </button>

          <button
            onClick={() => setStatusFilter('COMPLETED')}
            className={`p-5 rounded-xl transition-all duration-200 ${
              statusFilter === 'COMPLETED' 
                ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 scale-105' 
                : 'bg-white border-2 border-gray-200 hover:border-primary-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`text-3xl font-bold mb-1 ${
              statusFilter === 'COMPLETED' ? 'text-white' : 'text-gray-900'
            }`}>{stats.completed}</div>
            <div className={`text-xs font-medium ${
              statusFilter === 'COMPLETED' ? 'text-primary-100' : 'text-gray-600'
            }`}>완료</div>
          </button>

          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`p-5 rounded-xl transition-all duration-200 ${
              statusFilter === 'REJECTED' 
                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 scale-105' 
                : 'bg-white border-2 border-gray-200 hover:border-red-300 hover:shadow-md hover:-translate-y-0.5'
            }`}
          >
            <div className={`text-3xl font-bold mb-1 ${
              statusFilter === 'REJECTED' ? 'text-white' : stats.rejected > 0 ? 'text-red-600' : 'text-gray-900'
            }`}>{stats.rejected}</div>
            <div className={`text-xs font-medium ${
              statusFilter === 'REJECTED' ? 'text-red-100' : 'text-gray-600'
            }`}>반려</div>
          </button>
        </div>

        {/* 폴더별 통계 */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-1 h-6 bg-gradient-to-b from-primary-500 to-primary-600 rounded-full"></div>
            <h2 className="text-lg font-semibold text-gray-900">폴더별 문서 현황</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 미분류 문서 */}
            {folderStats['unclassified'] && (
              <button
                onClick={() => setSelectedFolder(selectedFolder === 'unclassified' ? null : 'unclassified')}
                className={`text-left p-5 rounded-xl transition-all duration-200 ${
                  selectedFolder === 'unclassified'
                    ? 'border-2 border-primary-600 bg-gradient-to-br from-primary-50 to-blue-50 shadow-md shadow-primary-200/50 scale-[1.02]'
                    : 'border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900">미분류</h3>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-full">{folderStats['unclassified'].total}개</span>
                </div>
                
                {/* 프로그레스 바 */}
                <div className="mb-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${folderStats['unclassified'].total > 0 
                          ? (folderStats['unclassified'].completed / folderStats['unclassified'].total) * 100 
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    완료 <span className="font-medium text-primary-600">{folderStats['unclassified'].completed}</span>
                  </span>
                  <span className="text-gray-600">
                    진행중 <span className="font-medium text-gray-900">{folderStats['unclassified'].inProgress}</span>
                  </span>
                  <span className="text-xs text-gray-500">
                    {folderStats['unclassified'].total > 0 
                      ? Math.round((folderStats['unclassified'].completed / folderStats['unclassified'].total) * 100)
                      : 0}%
                  </span>
                </div>
              </button>
            )}
            
            {/* 폴더별 통계 */}
            {folders.map((folder) => {
              const stats = folderStats[folder.id] || { total: 0, completed: 0, inProgress: 0 };
              const completionRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
              
              return (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                  className={`text-left p-5 rounded-xl transition-all duration-200 ${
                    selectedFolder === folder.id
                      ? 'border-2 border-primary-600 bg-gradient-to-br from-primary-50 to-blue-50 shadow-md shadow-primary-200/50 scale-[1.02]'
                      : 'border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="p-2 bg-primary-100 rounded-lg flex-shrink-0">
                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-900 truncate">{folder.name}</h3>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full ml-2">{stats.total}개</span>
                  </div>
                  
                  {/* 프로그레스 바 */}
                  <div className="mb-3">
                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary-500 to-primary-600 h-2.5 rounded-full transition-all duration-500 ease-out shadow-sm"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      완료 <span className="font-medium text-primary-600">{stats.completed}</span>
                    </span>
                    <span className="text-gray-600">
                      진행중 <span className="font-medium text-gray-900">{stats.inProgress}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {Math.round(completionRate)}%
                    </span>
                  </div>
                </button>
              );
            })}

            {folders.length === 0 && !folderStats['unclassified'] && (
              <div className="col-span-full text-center py-8 text-gray-500">
                폴더가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 검색 */}
        <div className="mb-6">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="문서명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* 선택된 필터 표시 */}
        {(statusFilter !== 'ALL' || selectedFolder !== null) && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">필터:</span>
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg text-sm font-medium shadow-sm">
                {statusFilter === 'EDITING' ? '작성중' :
                 statusFilter === 'REVIEWING' ? '검토중' :
                 statusFilter === 'SIGNING' ? '서명중' :
                 statusFilter === 'COMPLETED' ? '완료' :
                 statusFilter === 'REJECTED' ? '반려' : statusFilter}
                <button onClick={() => setStatusFilter('ALL')} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            {selectedFolder !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-lg text-sm font-medium shadow-sm">
                {selectedFolder === 'unclassified' ? '미분류' : folders.find(f => f.id === selectedFolder)?.name || '폴더'}
                <button onClick={() => setSelectedFolder(null)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            )}
            <button
              onClick={() => { setStatusFilter('ALL'); setSelectedFolder(null); }}
              className="text-sm text-gray-600 hover:text-primary-600 font-medium transition-colors"
            >
              모두 지우기
            </button>
          </div>
        )}

        {/* 문서 목록 */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchQuery ? '검색 결과가 없습니다.' : '문서가 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      문서명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      작성자
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      생성일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      마감일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDocuments.map((doc) => {
                    const editor = doc.tasks?.find(task => task.role === 'EDITOR');
                    const status = getStatusDisplay(doc);

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => handleWorkflow(doc)}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900 font-medium">
                            {doc.title || doc.templateName || '제목 없음'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${status.color}`}>
                            {status.text}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {editor?.assignedUserName || editor?.assignedUserEmail || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(doc.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          {doc.deadline ? (
                            <span className="text-sm text-gray-600">
                              {formatDate(doc.deadline)}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 작업현황 모달 */}
      <WorkflowModal
        isOpen={showWorkflowModal}
        onClose={() => setShowWorkflowModal(false)}
        document={selectedWorkflowDocument}
      />
    </div>
  );
};

export default StaffDashboard;
