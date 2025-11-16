import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTemplateStore } from '../stores/templateStore';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import UploadExcelButton from '../components/UploadExcelButton';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import MultiPageTemplatePreview from './TemplateUpload/components/MultiPageTemplatePreview';
import { TemplateField } from '../types/field';

interface PdfPage {
  pageNumber: number;
  imageUrl: string;
  width: number;
  height: number;
}

const DocumentNew: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedTemplateId = searchParams.get('templateId');
  const urlMode = searchParams.get('mode') as 'single' | 'bulk' | null;

  const { templates, getTemplates } = useTemplateStore();
  const { createDocument, loading } = useDocumentStore();
  const { user, refreshUser } = useAuthStore();
  const hasFolderAccess: boolean = (user as unknown as { hasFolderAccess?: boolean })?.hasFolderAccess === true;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    preselectedTemplateId || ''
  );

  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [deadline, setDeadline] = useState<string>('');
  const [stagingId, setStagingId] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [creationMode, setCreationMode] = useState<'single' | 'bulk'>(urlMode || 'single');
  type UploadedUser = { name: string; email: string; userStatus: 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN' };
  const [uploadedUsers, setUploadedUsers] = useState<UploadedUser[]>([]);
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [pdfPages, setPdfPages] = useState<PdfPage[]>([]);

  type StagingItem = {
    name?: string;
    studentName?: string;
    email?: string;
    studentEmail?: string;
    userStatus?: 'REGISTERED' | 'UNREGISTERED' | string;
  };

  const normalizeStatus = (status: unknown): UploadedUser['userStatus'] => {
    return status === 'REGISTERED' || status === 'UNREGISTERED' ? status : 'UNKNOWN';
  };

  useEffect(() => {
    getTemplates();
  }, [getTemplates]);
  
  // 페이지 진입 시 최신 사용자 권한 동기화 (has_folder_access)
  useEffect(() => {
    refreshUser();
    console.log('[DocumentNew] refreshUser called');
  }, [refreshUser]);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = templates.find(t => t.id === parseInt(selectedTemplateId));
      if (template && !documentTitle) {
        setDocumentTitle(template.name);
      }

      // 템플릿 필드 정보 및 PDF 페이지 가져오기
      const fetchTemplateFields = async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/templates/${selectedTemplateId}`);
          const template = response.data;

          let parsedFields: any[] = [];
          if (template.coordinateFields) {
            try {
              parsedFields = typeof template.coordinateFields === 'string'
                ? JSON.parse(template.coordinateFields)
                : template.coordinateFields;
            } catch (error) {
              console.error('coordinateFields 파싱 실패:', error);
            }
          }

          // coordinateFields를 TemplateField 형태로 변환
          const convertedFields: TemplateField[] = parsedFields.map((field, index) => ({
            id: field.id || `field-${index}`,
            label: field.label || `필드 ${index + 1}`,
            type: field.type || 'text',
            x: field.x || 0,
            y: field.y || 0,
            width: field.width || 100,
            height: field.height || 30,
            required: field.required || false,
            page: field.page || 1,
            fontSize: field.fontSize || 18,
            fontFamily: field.fontFamily || 'Arial',
            ...(field.tableData && { tableData: field.tableData })
          }));

          setTemplateFields(convertedFields);

          // PDF 페이지 정보 파싱
          console.log('🔍 템플릿 데이터:', {
            pdfImagePath: template.pdfImagePath,
            pdfImagePaths: template.pdfImagePaths,
            pdfImagePathsType: typeof template.pdfImagePaths
          });

          let parsedPages: PdfPage[] = [];
          if (template.pdfImagePaths) {
            try {
              let paths: string[] = [];

              // 1. 이미 배열인 경우
              if (Array.isArray(template.pdfImagePaths)) {
                paths = template.pdfImagePaths;
              }
              // 2. 문자열인 경우
              else if (typeof template.pdfImagePaths === 'string') {
                const trimmed = template.pdfImagePaths.trim();

                // 2-1. JSON 배열 형식 시도 (예: ["path1", "path2"])
                if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                  try {
                    paths = JSON.parse(trimmed);
                    console.log('✅ JSON 파싱 성공:', paths);
                  } catch (jsonError) {
                    // JSON 파싱 실패 시 수동 파싱
                    // "[path1, path2, path3]" -> "path1, path2, path3" -> ["path1", "path2", "path3"]
                    const content = trimmed.slice(1, -1); // 대괄호 제거
                    paths = content
                      .split(',')
                      .map(p => p.trim())
                      .filter(p => p.length > 0);
                    console.log('✅ 수동 파싱 성공:', paths);
                  }
                }
                // 2-2. 쉼표로 구분된 문자열 (예: "path1, path2, path3")
                else if (trimmed.includes(',')) {
                  paths = trimmed
                    .split(',')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);
                  console.log('✅ 쉼표 구분 파싱 성공:', paths);
                }
                // 2-3. 단일 경로 문자열
                else {
                  paths = [trimmed];
                  console.log('✅ 단일 경로:', paths);
                }
              }

              // 파싱된 경로들로 PdfPage 배열 생성
              if (paths.length > 0) {
                parsedPages = paths.map((path: string, index: number) => ({
                  pageNumber: index + 1,
                  imageUrl: path.startsWith('/') ? path : `/${path}`,
                  width: 1240,  // A4 기준
                  height: 1754
                }));
              } else {
                throw new Error('파싱된 경로가 없습니다');
              }
            } catch (error) {
              // 실패 시 단일 이미지로 폴백
              if (template.pdfImagePath) {
                parsedPages = [{
                  pageNumber: 1,
                  imageUrl: `/${template.pdfImagePath}`,
                  width: 1240,
                  height: 1754
                }];
              }
            }
          } else if (template.pdfImagePath) {
            // pdfImagePaths가 없으면 단일 pdfImagePath 사용
            console.log('⚠️ pdfImagePaths 없음, pdfImagePath 사용:', template.pdfImagePath);
            parsedPages = [{
              pageNumber: 1,
              imageUrl: `/${template.pdfImagePath}`,
              width: 1240,
              height: 1754
            }];
          }

          setPdfPages(parsedPages);
        } catch (error) {
          console.error('템플릿 필드 로드 실패:', error);
          setTemplateFields([]);
          setPdfPages([]);
        }
      };

      fetchTemplateFields();
    } else {
      setTemplateFields([]);
      setPdfPages([]);
    }
  }, [selectedTemplateId, templates, documentTitle]);

  // stagingId가 설정되면 업로드된 사용자 목록을 조회하여 페이지에 표시
  useEffect(() => {
    const fetchStagingItems = async () => {
      if (!stagingId) return;
      try {
        const url = `${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BULK_STAGING_ITEMS(stagingId)}`;
        const response = await axios.get(url);
        const items: StagingItem[] = Array.isArray(response.data?.items) ? response.data.items as StagingItem[] : [];
        const users: UploadedUser[] = items.map((item: StagingItem) => ({
          name: String(item.name || item.studentName || ''),
          email: String(item.email || item.studentEmail || ''),
          userStatus: normalizeStatus(item.userStatus),
        }));
        setUploadedUsers(users);
      } catch (err) {
        console.error('Failed to fetch staging items:', err);
        setUploadedUsers([]);
      }
    };

    fetchStagingItems();
  }, [stagingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplateId) {
      alert('템플릿을 선택해주세요.');
      return;
    }

    try {
      if (stagingId) {
        // 엑셀 업로드 데이터가 있는 경우 DocumentCreateRequest에 stagingId 포함
        console.log('=== 엑셀 데이터 있음! ===');
        console.log('Staging ID:', stagingId);
        console.log('Template ID:', selectedTemplateId);
        console.log('Editor Email:', user?.email);
        console.log('Document Title:', documentTitle);
        
        const requestData = {
          templateId: parseInt(selectedTemplateId),
          editorEmail: user?.email,
          title: undefined,
          deadline: deadline || undefined,
          stagingId: stagingId
        } as const;
        
        console.log('Request data:', requestData);
        console.log('Request URL:', `${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BASE}`);
        console.log('=====================================');
        
        const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BASE}`, requestData);
        
        const result = response.data;
        console.log('Bulk commit result:', result);
        
        let message = '';
        if (result.created > 0) {
          message += `${result.created}개의 문서 생성 완료`;
        }
        if (result.skipped > 0) {
          if (message) message += ', ';
          message += `${result.skipped}개 건너뜀`;
        }
        if (result.failed > 0) {
          if (message) message += ', ';
          message += `${result.failed}개 실패`;
        }
        
        alert(message || '문서 처리가 완료되었습니다.');
      } else {
        // 엑셀파일 업로드 없을시 -> 일반 단일 문서 생성
        await createDocument({
          templateId: parseInt(selectedTemplateId),
          editorEmail: user?.email,
          title: documentTitle.trim() || undefined,
          deadline: deadline || undefined,
        });

        alert('문서가 생성되었습니다.');
      }
      navigate(`/documents`);
    } catch (error) {
      console.error('=== Document creation error details ===');
      console.error('Error type:', typeof error);
      console.error('Error object:', error);
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { 
          response?: { 
            data?: { error?: string; message?: string; details?: unknown }; 
            status?: number; 
            statusText?: string;
            headers?: Record<string, string>;
          };
          config?: unknown;
        };
        
        console.error('Response status:', axiosError.response?.status);
        console.error('Response statusText:', axiosError.response?.statusText);
        console.error('Response data:', axiosError.response?.data);
        console.error('Response headers:', axiosError.response?.headers);
        console.error('Request config:', axiosError.config);
        
        const errorMessage = axiosError.response?.data?.error || 
                           axiosError.response?.data?.message || 
                           `문서 생성에 실패했습니다. (${axiosError.response?.status})`;
        
        console.error('Final error message:', errorMessage);
        alert(errorMessage);
      } else {
        console.error('Non-axios error:', error);
        alert('문서 생성에 실패했습니다.');
      }
      console.error('=====================================');
    }
  };

  const selectedTemplate = templates.find(t => t.id === parseInt(selectedTemplateId));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">새 문서 생성</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 왼쪽: 문서 생성 폼 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">문서 정보</h2>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 템플릿 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                템플릿 선택 *
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="input"
                required
              >
                <option value="">템플릿을 선택하세요</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} (PDF 템플릿)
                  </option>
                ))}
              </select>
            </div>

            {/* 문서 제목 입력 - bulk 모드에서는 제목 입력칸 숨기고 안내 문구 표시 */}
            {creationMode === 'bulk' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
                  문서 제목은 "이름_교과목_근무일지" 형식으로 자동 설정됩니다.
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  제목 *
                </label>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  className="input"
                  placeholder="문서 제목을 입력하세요"
                  required
                />
              </div>
            )}

            {/* 만료일 선택 - single 모드와 bulk 모드 모두 표시 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                만료일
              </label>
              
              {/* 빠른 선택 버튼들 */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: '1일 후', days: 1 },
                  { label: '3일 후', days: 3 },
                  { label: '7일 후', days: 7 },
                ].map((option) => {
                  // 한국 시간 기준으로 현재 시간 계산
                  const now = new Date();
                  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
                  const targetDate = new Date(koreaTime.getTime() + (option.days * 24 * 60 * 60 * 1000));
                  const targetValue = `${targetDate.toISOString().slice(0, 10)}T23:59`;
                  const isSelected = deadline === targetValue;

                  return (
                    <button
                      key={option.days}
                      type="button"
                      onClick={() => setDeadline(targetValue)}
                      className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 shadow-sm'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700 hover:shadow-sm'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
                {deadline && (
                  <button
                    type="button"
                    onClick={() => setDeadline('')}
                    className="px-4 py-2 text-sm font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded-full transition-all duration-200 hover:shadow-sm"
                  >
                    초기화
                  </button>
                )}
              </div>
              
              {/* 날짜와 시간 선택을 분리 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 날짜 선택 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
                  <input
                    type="date"
                    value={deadline ? deadline.slice(0, 10) : ''}
                    min={(() => {
                      const now = new Date();
                      const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
                      return koreaTime.toISOString().slice(0, 10);
                    })()}
                    onChange={(e) => {
                      const dateValue = e.target.value;
                      const timeValue = deadline ? deadline.slice(11, 16) : '00:00';
                      setDeadline(dateValue && timeValue ? `${dateValue}T${timeValue}` : '');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                </div>

                {/* 시간 선택 */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">시간</label>
                  <input
                    type="time"
                    value={deadline ? deadline.slice(11, 16) : ''}
                    onChange={(e) => {
                      const dateValue = deadline ? deadline.slice(0, 10) : '';
                      const timeValue = e.target.value;
                      if (dateValue && timeValue) {
                        setDeadline(`${dateValue}T${timeValue}`);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                작성자가 문서 편집을 완료해야 하는 마감일을 지정할 수 있습니다. 현재 시간 이후로만 선택 가능합니다.
              </p>
            </div>

            {/* 선택된 템플릿 설명 (읽기 전용) */}
            {selectedTemplate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {selectedTemplate.description || '설명이 없습니다.'}
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  이 설명은 선택된 템플릿의 정보입니다. (수정 불가)
                </p>
              </div>
            )}

            <div>
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    작성자
                  </label>
                  {/* URL 파라미터로 mode가 지정되지 않았거나, 권한이 있는 경우에만 모드 전환 버튼 표시 */}
                  {!urlMode && hasFolderAccess && (
                    <div className="flex items-center space-x-2">
                      <button
                          type="button"
                          onClick={() => {
                            setCreationMode('single');
                            setStagingId(null);
                            setUploadSummary(null);
                            setUploadedUsers([]);
                          }}
                          className={`px-3 py-1 rounded border text-sm ${
                              creationMode === 'single'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-700 border-gray-300'
                          }`}
                      >
                        개인 문서 생성
                      </button>
                      <button
                          type="button"
                          onClick={() => setCreationMode('bulk')}
                          className={`px-3 py-1 rounded border text-sm ${
                              creationMode === 'bulk'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-700 border-gray-300'
                          }`}
                      >
                        일괄 문서 생성
                      </button>
                    </div>
                  )}
                  {urlMode && (
                    <div className="text-sm text-gray-500">
                      {urlMode === 'single' ? '개인 문서 생성 모드' : '일괄 문서 생성 모드'}
                    </div>
                  )}
                </div>
                {hasFolderAccess && creationMode === 'bulk' && (
                    <div className="flex justify-end">
                      <UploadExcelButton
                          templateId={selectedTemplateId}
                          onUploadComplete={(newStagingId, summary) => {
                            setStagingId(newStagingId);
                            setUploadSummary(summary);
                            console.log('Excel upload completed:', { stagingId: newStagingId, summary });
                          }}
                      />
                    </div>
                )}
              </div>
              {creationMode === 'single' && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                        {user?.name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">{user?.name || '사용자'}</div>
                        <div className="text-sm text-gray-600">{user?.email || 'email@example.com'}</div>
                        <div className="text-xs text-blue-600">✓ 자동 할당 (본인)</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    자동으로 작성자로 할당됩니다.
                  </p>
                </>
              )}

              {creationMode === 'bulk' && hasFolderAccess && !uploadSummary && uploadedUsers.length === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                      📋
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-900 mb-2">일괄 문서 일괄 생성 안내</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• 엑셀 파일을 업로드하여 일괄적으로 문서를 한번에 생성할 수 있습니다</li>
                        <li>• 각 문서는 엑셀의 해당 행 정보를 바탕으로 생성됩니다</li>
                        <li>• 작성자는 각 문서 생성 시 개별적으로 지정됩니다</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              {/* 엑셀 업로드 상태 표시 (Bulk 모드에서만) */}
              {hasFolderAccess && creationMode === 'bulk' && uploadSummary && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium text-green-800">
                      엑셀 업로드 완료
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    총 {uploadSummary.total}행 중 {uploadSummary.valid}개 문서 생성 예정
                    {uploadSummary.invalid > 0 && ` (${uploadSummary.invalid}개 오류)`}
                  </p>
                </div>
              )}

              {/* 업로드된 사용자 목록 */}
              {hasFolderAccess && creationMode === 'bulk' && uploadedUsers.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">업로드된 사용자</h4>
                  <div className="space-y-2">
                    {uploadedUsers.map((u, idx) => (
                      <div key={`${u.email}-${idx}`} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                              {(u.name && u.name.charAt(0)) || (u.email && u.email.charAt(0)) || 'U'}
                            </div>
                            <div>
                              <div className="font-medium text-gray-800">{u.name || '이름 없음'}</div>
                              <div className="text-sm text-gray-600">{u.email || '이메일 없음'}</div>
                            </div>
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            u.userStatus === 'REGISTERED'
                              ? 'bg-blue-100 text-blue-800'
                              : u.userStatus === 'UNREGISTERED'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {u.userStatus === 'REGISTERED' ? '가입된 회원' : u.userStatus === 'UNREGISTERED' ? '회원가입 필요' : '상태 불명'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (creationMode === 'bulk' && stagingId) {
                      await axios.post(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BULK_CANCEL}`, { stagingId });
                    }
                  } catch (e) {
                    console.error('Bulk cancel failed:', e);
                  } finally {
                    navigate('/templates');
                  }
                }}
                className="btn btn-secondary flex-1"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={
                  loading ||
                  !selectedTemplateId ||
                  (creationMode !== 'bulk' && !documentTitle.trim()) ||
                  (creationMode === 'bulk' && !stagingId)
                }
                className="btn btn-primary flex-1"
              >
                {loading ? '생성 중...' : 
                 creationMode === 'bulk' && stagingId ? `문서 생성 (${uploadSummary?.valid || 0}개)` : '문서 생성'}
              </button>
            </div>
          </form>
        </div>

        {/* 오른쪽: 템플릿 미리보기 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">템플릿 미리보기</h2>
          
          {selectedTemplate ? (
            <div>
              {/* 템플릿 기본 정보 */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 mb-6">
                <h3 className="font-bold text-gray-800 text-lg mb-2">{selectedTemplate.name}</h3>
                {selectedTemplate.description && (
                  <p className="text-gray-600 mb-3">{selectedTemplate.description}</p>
                )}
                
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    생성일: {new Date(selectedTemplate.createdAt).toLocaleDateString('ko-KR')}
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    작성자: {selectedTemplate.createdByName}
                  </div>
                </div>
              </div>

              {/* PDF 기반 템플릿 미리보기 - MultiPageTemplatePreview 컴포넌트 사용 */}
              {selectedTemplate.pdfFilePath && pdfPages.length > 0 ? (
                <div className="h-[600px]">
                  <MultiPageTemplatePreview
                    pages={pdfPages}
                    fields={templateFields}
                    selectedFieldId={null}
                    onFieldClick={() => {}}
                    onFieldMove={() => {}}
                    onFieldResize={() => {}}
                    onTableCellClick={() => {}}
                    onCanvasClick={() => {}}
                    isInteractive={false}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📄</div>
                  <p>PDF 파일이 업로드되지 않은 템플릿입니다.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-medium mb-2">템플릿을 선택해주세요</h3>
              <p className="text-sm">
                왼쪽에서 템플릿을 선택하면<br />
                해당 템플릿의 상세 정보를 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentNew; 