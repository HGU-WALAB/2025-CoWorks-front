import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

interface PreviewRow {
  row: number;
  id: string;
  name: string;
  email: string;
  course: string;
  status: 'VALID' | 'INVALID';
  reason?: string;
  userStatus?: 'REGISTERED' | 'UNREGISTERED' | 'UNKNOWN'; // 백엔드 응답에 맞게 수정
}

// 학생들 정보 결과
interface PreviewResult {
  stagingId: string;
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  rows: PreviewRow[];
  expiresAt: string;
}

interface UploadExcelModalProps {
  templateId: string;
  onClose: () => void;
  onUploadComplete: (stagingId: string, summary: { total: number; valid: number; invalid: number }) => void;
}

const UploadExcelModal: React.FC<UploadExcelModalProps> = ({
  templateId,
  onClose,
  onUploadComplete,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'result'>('upload');
  const isConfirmedRef = useRef(false); // cleanup 함수에서 참조할 ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 컴포넌트 unmount 시 자동 bulk/cancel 실행되도록 (확인 버튼을 누르지 않은 경우에만)
  useEffect(() => {
    return () => {
      if (previewResult?.stagingId && !isConfirmedRef.current) {
        console.log('UploadExcelModal unmount - calling cancel for stagingId:', previewResult.stagingId);
        // 비동기로 cancel 요청 (조용히 처리)
        axios.post(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BULK_CANCEL}`, {
          stagingId: previewResult.stagingId,
        }).catch(() => {
          // 에러 무시
        });
      } else if (isConfirmedRef.current) {
        console.log('UploadExcelModal unmount - skip cancel because user confirmed');
      }
    };
  }, [previewResult?.stagingId]);

  const handleFileSelect = (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv', // .csv
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('지원하는 파일 형식이 아닙니다. (.xlsx, .xls, .csv 파일만 업로드 가능)');
      return;
    }

    // 파일 크기 제한 체크 (대략적인 행 수 추정)
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSizeBytes) {
      alert('파일 크기가 너무 큽니다. 최대 500행까지 업로드 가능합니다.');
      return;
    }

    setSelectedFile(file);
    setPreviewResult(null);
    setCurrentStep('upload');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // 1단계: 파일 업로드 및 데이터 임시 저장 - data는 Staging 테이블에 저장됨
  const handleUpload = async () => {
    if (!selectedFile) {
      alert('파일을 선택해주세요.');
      return;
    }

    setIsUploading(true);
    setPreviewResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('templateId', templateId);

      const requestUrl = `${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BULK_PREVIEW}`;
      console.log('=== 업로드 요청 디버깅 ===');
      console.log('API Base URL:', API_BASE_URL);
      console.log('Endpoint:', API_ENDPOINTS.DOCUMENTS.BULK_PREVIEW);
      console.log('Full Request URL:', requestUrl);
      console.log('Template ID:', templateId);
      console.log('FormData contents:');

      // FormData 내용 확인
      for (const [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value);
      }
      
      console.log('Axios default headers:', axios.defaults.headers.common);
      console.log('Available endpoints:', Object.keys(API_ENDPOINTS.DOCUMENTS));
      
      // 백엔드 서버 연결 테스트
      try {
        const healthCheck = await axios.get(`${API_BASE_URL.replace('/api', '')}/actuator/health`);
        console.log('Backend health check:', healthCheck.status);
      } catch (healthError) {
        console.log('Backend health check failed:', healthError);
        console.log('백엔드 서버가 실행 중이지 않을 수 있습니다.');
      }
      
      console.log('========================');

      const response = await axios.post(requestUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('=== 응답 디버깅 ===');
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response data type:', typeof response.data);
      console.log('Response data:', response.data);
      console.log('==================');

      const result = response.data;
      console.log('=== 백엔드 응답 디버깅 ===');
      console.log('Raw backend response:', result);
      console.log('Response structure:', Object.keys(result));
      console.log('totalRows:', result.totalRows);
      console.log('validRows:', result.validRows);
      console.log('rows type:', typeof result.rows);
      console.log('rows isArray:', Array.isArray(result.rows));
      console.log('rows length:', result.rows?.length);
      console.log('First few rows:', result.rows?.slice(0, 3));
      
      // 각 행의 필드명 확인
      if (Array.isArray(result.rows) && result.rows.length > 0) {
        console.log('첫 번째 행의 필드명들:', Object.keys(result.rows[0]));
        console.log('첫 번째 행의 값들:', Object.values(result.rows[0]));
      }
      
      // 다른 가능한 키들도 확인
      const possibleKeys = ['data', 'items', 'students', 'records', 'users'];
      possibleKeys.forEach(key => {
        if (result[key]) {
          console.log(`Found data in key '${key}':`, result[key]);
          if (Array.isArray(result[key]) && result[key].length > 0) {
            console.log(`First item in '${key}':`, result[key][0]);
            console.log(`Fields in '${key}':`, Object.keys(result[key][0]));
          }
        }
      });
      
      console.log('================중간 점검========');
      
      // 백엔드 응답을 우리 인터페이스에 맞게 변환
      const transformedResult: PreviewResult = {
        stagingId: result.stagingId || 'temp-id',
        summary: {
          total: result.totalRows || result.total || 0,
          valid: result.validRows || result.valid || 0,
          invalid: (result.totalRows || result.total || 0) - (result.validRows || result.valid || 0)
        },
        rows: (() => {
          // 다양한 키에서 행 데이터 찾기
          const possibleRowsKeys = ['rows', 'data', 'items', 'students', 'records'];
          let rowsData: unknown[] = [];
          
          for (const key of possibleRowsKeys) {
            if (Array.isArray(result[key])) {
              console.log(`Found rows data in key: ${key}`);
              rowsData = result[key];
              break;
            }
          }
          
          if (rowsData.length === 0) {
            console.log('No valid rows data found, checking if result itself is an array');
            if (Array.isArray(result)) {
              rowsData = result;
            }
          }
          
          return Array.isArray(rowsData) ? rowsData.map((row: unknown, index: number) => {
            if (typeof row !== 'object' || row === null) {
              console.log(`Row ${index} is not an object:`, row);
              return {
                row: index + 1,
                id: String(row || ''),
                name: '',
                email: '',
                course: '',
                status: 'VALID' as const,
                reason: undefined
              };
            }
            
            const rowObj = row as Record<string, unknown>;
            console.log(`=== Row ${index} 처리 ===`);
            console.log('원본 row 데이터:', rowObj);
            console.log('Row의 모든 키:', Object.keys(rowObj));
            console.log('Row의 값들:', Object.values(rowObj));
            
            // 다양한 필드명 패턴을 지원하는 매핑 함수
            const getFieldValue = (row: Record<string, unknown>, ...fieldNames: string[]) => {
              console.log(`필드 검색 중: ${fieldNames.join(', ')}`);
              for (const fieldName of fieldNames) {
                const value = row[fieldName];
                if (value !== undefined && value !== null && value !== '') {
                  console.log(`찾은 값: ${fieldName} = ${value}`);
                  return String(value);
                }
              }
              console.log(`값을 찾지 못함: ${fieldNames.join(', ')}`);
              return '';
            };

            const transformedRow = {
              row: (typeof rowObj.row === 'number' ? rowObj.row : typeof rowObj.rowNumber === 'number' ? rowObj.rowNumber : index + 1),
              id: getFieldValue(rowObj, 'id', 'studentId', 'student_id', '학번', 'ID', 'Id', 'user_id', 'userId', 'student_id', 'studentId'),
              name: getFieldValue(rowObj, 'name', 'studentName', 'student_name', '이름', '성명', '학생이름', 'fullName', 'student', 'user_name', 'userName', 'student_name', 'studentName'),
              email: getFieldValue(rowObj, 'email', 'studentEmail', 'student_email', '이메일', 'emailAddress', 'mail', 'user_email', 'userEmail', 'student_email', 'studentEmail'),
              course: getFieldValue(rowObj, 'course', 'department', 'dept', 'major', '과정', '학과', '전공', 'program', 'field', 'subject', 'class', '과목'),
              status: (rowObj.status === 'VALID' || rowObj.status === 'INVALID') ? rowObj.status : 
                      (rowObj.valid === true ? 'VALID' : 'INVALID') as 'VALID' | 'INVALID',
              reason: rowObj.reason ? String(rowObj.reason) : rowObj.error ? String(rowObj.error) : undefined
            };
            console.log(`변환된 row ${index}:`, transformedRow);
            console.log('===================');
            return transformedRow;
        }) : (() => {
          console.log('No rows array found, stagingId가 있으면 실제 DB에서 조회할 예정');
          // stagingId가 있으면 빈 배열 반환 (실제 DB에서 조회할 예정)
          // stagingId가 없으면 임시 데이터 생성
          return [];
        })();
        })(),
        expiresAt: result.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30분 후
      };
      
      // stagingId가 있는 경우 샘플 데이터 생성하지 않음 (실제 DB에서 조회할 예정)
      if (transformedResult.stagingId && transformedResult.stagingId !== 'temp-id') {
        console.log('stagingId가 있으므로 샘플 데이터 생성하지 않음, 실제 DB에서 조회 예정');
      } else if (transformedResult.rows.length === 0 && transformedResult.summary.total > 0) {
        console.log('stagingId가 없고 데이터가 비어있지만 총 행수가 있음, 샘플 데이터 생성');
        transformedResult.rows = Array.from({ length: transformedResult.summary.total }, (_, index) => ({
          row: index + 1,
          id: `ID${index + 1}`,
          name: `학생${index + 1}`,
          email: `student${index + 1}@example.com`,
          course: '정보미제공',
          status: 'VALID' as const,
          reason: undefined
        }));
      }
      
      console.log('=== 최종 변환 결과 ===');
      console.log('Transformed result:', transformedResult);
      console.log('Rows length:', transformedResult.rows.length);
      console.log('Summary:', transformedResult.summary);
      console.log('First few rows:', transformedResult.rows.slice(0, 3));
      console.log('========================');
      
      // Modal에서는 결과를 표시하지 않고 즉시 상위로 전달 후 닫기
      if (transformedResult.stagingId && transformedResult.stagingId !== 'temp-id') {
        console.log('Upload completed. Passing staging info to parent and closing modal.');
        isConfirmedRef.current = true; // unmount 시 cancel 방지
        onUploadComplete(transformedResult.stagingId, transformedResult.summary);
        onClose();
        return;
      }
    } catch (error: unknown) {
      console.error('=== 업로드 에러 디버깅 ===');
      console.error('Error type:', typeof error);
      console.error('Error object:', error);
      
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { 
          response?: { 
            data?: { message?: string; error?: string; details?: unknown }; 
            status?: number; 
            statusText?: string;
            headers?: Record<string, string>;
          };
          request?: unknown;
          config?: unknown;
        };
        
        console.error('Axios error details:');
        console.error('  Status:', axiosError.response?.status);
        console.error('  Status text:', axiosError.response?.statusText);
        console.error('  Response data:', axiosError.response?.data);
        console.error('  Response headers:', axiosError.response?.headers);
        console.error('  Request config:', axiosError.config);
        
        
        const errorMessage = axiosError.response?.data?.message || 
                           axiosError.response?.data?.error || 
                           `서버 오류 (${axiosError.response?.status}): ${axiosError.response?.statusText}`;
        alert(errorMessage);
      } else if (error && typeof error === 'object' && 'message' in error) {
        console.error('Network or other error:', error);
        alert(`네트워크 오류: ${(error as { message: string }).message}`);
      } else {
        console.error('Unknown error:', error);
        alert('알 수 없는 오류가 발생했습니다.');
      }
      console.error('========================');
    } finally {
      setIsUploading(false);
    }
  };

  
  const handleClose = () => {
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 결과 테이블은 페이지에서 표시하므로 모달에는 포함하지 않음

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            엑셀 파일 업로드
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 모달 내용 */}
        <div className="p-6 space-y-6">
          {/* 1단계: 파일 업로드 */}
          {currentStep === 'upload' && (
            <>
          {/* 파일 업로드 영역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              파일 선택
            </label>
            
            {/* 드래그 앤 드롭 영역 */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200
                ${isDragOver
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInputChange}
                className="hidden"
              />
              
              <div className="space-y-2">
                <svg className="w-12 h-12 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">
                    파일을 드래그하여 놓거나 클릭하여 선택하세요
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                        지원 형식: .xlsx, .xls, .csv (최대 500행)
                  </p>
                </div>
              </div>
            </div>

            {/* 선택된 파일 정보 */}
            {selectedFile && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">
                        {selectedFile.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 업로드 버튼 */}
          <div className="flex justify-center">
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
              className={`
                px-6 py-3 rounded-lg font-medium transition-colors duration-200
                ${selectedFile && !isUploading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {isUploading ? (
                <div className="flex items-center space-x-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>업로드 중...</span>
                </div>
              ) : (
                '업로드'
              )}
            </button>
          </div>
            </>
          )}

          {/* 모달은 결과를 보여주지 않음 */}
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadExcelModal;
