import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import { useFolderStore } from '../stores/folderStore';
import { Document } from '../types/document';

const ReviewDashboard: React.FC = () => {
  const { documents, fetchDocuments, loading } = useDocumentStore();
  const { folders, loadFolderContents } = useFolderStore();
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDocuments();
      loadFolderContents(null);
    }
  }, [isAuthenticated, fetchDocuments, loadFolderContents]);

  // 검토 단계 문서만 필터링
  const reviewingDocuments = useMemo(() => {
    return documents.filter(doc => doc.status === 'REVIEWING');
  }, [documents]);

  // 폴더별 검토 문서 통계
  const folderStats = useMemo(() => {
    const stats: Record<string, number> = {};
    
    reviewingDocuments.forEach(doc => {
      const folderId = doc.folderId || 'unclassified';
      stats[folderId] = (stats[folderId] || 0) + 1;
    });
    
    return stats;
  }, [reviewingDocuments]);

  // 문서 클릭 핸들러 - 검토 페이지로 이동
  const handleDocumentClick = (documentId: string) => {
    navigate(`/documents/${documentId}/review`);
  };

  // 필터링된 문서 목록
  const filteredDocuments = useMemo(() => {
    let filtered = reviewingDocuments;

    // 폴더 필터
    if (selectedFolder !== null) {
      if (selectedFolder === 'unclassified') {
        filtered = filtered.filter(doc => !doc.folderId);
      } else {
        filtered = filtered.filter(doc => doc.folderId === selectedFolder);
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
  }, [reviewingDocuments, searchQuery, selectedFolder]);

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
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">검토</h1>
          <p className="text-sm text-gray-600">검토 단계의 문서를 확인하고 관리하세요</p>
        </div>

        {/* 통계 카드 */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="text-3xl font-bold text-gray-900">{reviewingDocuments.length}</div>
              <div className="text-sm text-gray-600">검토 대기중인 문서</div>
            </div>
          </div>
        </div>

        {/* 폴더별 통계 */}
        {Object.keys(folderStats).length > 0 && (
          <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-1 h-6 bg-gradient-to-b from-yellow-500 to-yellow-600 rounded-full"></div>
              <h2 className="text-lg font-semibold text-gray-900">폴더별 검토 문서</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 미분류 문서 */}
              {folderStats['unclassified'] && (
                <button
                  onClick={() => setSelectedFolder(selectedFolder === 'unclassified' ? null : 'unclassified')}
                  className={`text-left p-5 rounded-xl transition-all duration-200 ${
                    selectedFolder === 'unclassified'
                      ? 'border-2 border-yellow-600 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-md shadow-yellow-200/50 scale-[1.02]'
                      : 'border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <h3 className="font-semibold text-gray-900">미분류</h3>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full">{folderStats['unclassified']}개</span>
                  </div>
                </button>
              )}
              
              {/* 폴더별 통계 */}
              {folders.map((folder) => {
                const count = folderStats[folder.id];
                if (!count) return null;
                
                return (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(selectedFolder === folder.id ? null : folder.id)}
                    className={`text-left p-5 rounded-xl transition-all duration-200 ${
                      selectedFolder === folder.id
                        ? 'border-2 border-yellow-600 bg-gradient-to-br from-yellow-50 to-orange-50 shadow-md shadow-yellow-200/50 scale-[1.02]'
                        : 'border-2 border-gray-200 bg-white hover:border-gray-300 hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="p-2 bg-yellow-100 rounded-lg flex-shrink-0">
                          <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </div>
                        <h3 className="font-semibold text-gray-900 truncate">{folder.name}</h3>
                      </div>
                      <span className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full ml-2">{count}개</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* 선택된 필터 표시 */}
        {selectedFolder !== null && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">필터:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-lg text-sm font-medium shadow-sm">
              {selectedFolder === 'unclassified' ? '미분류' : folders.find(f => f.id === selectedFolder)?.name || '폴더'}
              <button onClick={() => setSelectedFolder(null)} className="hover:bg-white/20 rounded-full p-0.5 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
            <button
              onClick={() => setSelectedFolder(null)}
              className="text-sm text-gray-600 hover:text-yellow-600 font-medium transition-colors"
            >
              모두 지우기
            </button>
          </div>
        )}

        {/* 문서 목록 */}
        <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm overflow-hidden">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mb-4">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500">
                {searchQuery ? '검색 결과가 없습니다.' : '검토 대기중인 문서가 없습니다.'}
              </p>
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
                      템플릿
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

                    return (
                      <tr
                        key={doc.id}
                        onClick={() => handleDocumentClick(doc.id)}
                        className="hover:bg-yellow-50 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-gray-900 font-medium">
                              {doc.title || '제목 없음'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {doc.templateName || '-'}
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
    </div>
  );
};

export default ReviewDashboard;
