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
      
      // stagingId가 있으면 실제 DB에서 데이터 조회 (우선순위)
      if (transformedResult.stagingId && transformedResult.stagingId !== 'temp-id') {
        console.log('stagingId로 실제 데이터 조회 시작:', transformedResult.stagingId);
        await fetchStagingItems(transformedResult.stagingId, transformedResult.summary);
      } else {
        console.log('stagingId가 없거나 임시 ID, 변환된 결과 사용');
        setPreviewResult(transformedResult);
        setCurrentStep('result');
      }
      
      // 상태 변경 후 확인
      setTimeout(() => {
        console.log('상태 변경 후 확인:', {
          currentStep: 'result',
          previewResultSet: true,
          rowsInState: transformedResult.rows.length
        });
      }, 100);
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

  // stagingId로 실제 DB에서 데이터 조회
  const fetchStagingItems = async (stagingId: string, summary: { total: number; valid: number; invalid: number }) => {
    try {
      console.log('=== stagingId로 데이터 조회 시작 ===');
      console.log('Staging ID:', stagingId);
      
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BULK_STAGING_ITEMS(stagingId)}`);
      
      console.log('Staging items response:', response.data);
      console.log('Response status:', response.status);
      
      const responseData = response.data;
      console.log('Response data structure:', responseData);
      
      // 백엔드 응답에서 items 배열 추출
      const stagingItems = responseData.items || responseData.data || responseData;
      
      console.log('Extracted staging items:', stagingItems);
      console.log('Items type:', typeof stagingItems);
      console.log('Items isArray:', Array.isArray(stagingItems));
      console.log('Items length:', stagingItems?.length);
      
      // 아이템이 없는 경우 오류 발생
      if (!Array.isArray(stagingItems) || stagingItems.length === 0) {
        console.error('stagingId로 조회된 아이템이 없음:', stagingId);
        alert(`업로드된 데이터를 찾을 수 없습니다. (stagingId: ${stagingId})`);
        setIsUploading(false);
        return;
      }
      
      // 백엔드 응답을 PreviewRow 형태로 변환
      const transformedRows: PreviewRow[] = stagingItems.map((item: Record<string, unknown>, index: number) => {
        console.log(`Processing staging item ${index}:`, item);
        
        const transformedRow = {
          row: typeof item.rowNumber === 'number' ? item.rowNumber : typeof item.row === 'number' ? item.row : index + 1,
          id: String(item.studentId || item.id || item.student_id || ''),
          name: String(item.name || item.studentName || item.student_name || ''),
          email: String(item.email || item.studentEmail || item.student_email || ''),
          course: String(item.course || item.department || item.dept || item.major || ''),
          status: (item.isValid === true ? 'VALID' : 'INVALID') as 'VALID' | 'INVALID',
          reason: item.reason ? String(item.reason) : item.error ? String(item.error) : undefined,
          userStatus: (item.userStatus === 'REGISTERED' || item.userStatus === 'UNREGISTERED') ? 
                     item.userStatus as 'REGISTERED' | 'UNREGISTERED' : 'UNKNOWN' as const
        };
        
        console.log(`Transformed staging row ${index}:`, transformedRow);
        return transformedRow;
      });
      
      console.log('Transformed staging rows:', transformedRows);
      
      // 최종 결과 생성 (백엔드에서 이미 userStatus를 제공하므로 별도 API 호출 불필요)
      const finalResult: PreviewResult = {
        stagingId: stagingId,
        summary: summary,
        rows: transformedRows,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };
      
      console.log('Final result with user status:', finalResult);
      
      setPreviewResult(finalResult);
      setCurrentStep('result');
      
    } catch (error) {
      console.error('Staging items fetch error:', error);
      
      // 조회 실패 시 오류 메시지 표시
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { 
          response?: { 
            status?: number; 
            statusText?: string;
            data?: { message?: string; error?: string };
          } 
        };
        
        if (axiosError.response?.status === 404) {
          alert(`업로드된 데이터를 찾을 수 없습니다. (stagingId: ${stagingId})`);
        } else {
          alert(`데이터 조회 중 오류가 발생했습니다: ${axiosError.response?.data?.message || axiosError.response?.statusText || '알 수 없는 오류'}`);
        }
    } else {
        alert(`데이터 조회 중 오류가 발생했습니다. (stagingId: ${stagingId})`);
      }
      
      setIsUploading(false);
    }
  };


  // 업로드 완료 처리 - stagingId를 상위 컴포넌트로 전달
  const handleUploadComplete = () => {
    if (previewResult?.stagingId && previewResult?.summary) {
      console.log('User confirmed upload - setting isConfirmedRef to true');
      isConfirmedRef.current = true; // ref 업데이트
      onUploadComplete(previewResult.stagingId, previewResult.summary);
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

  // 뽑아낸 학생들 테이블
  const PreviewTable: React.FC<{ rows: PreviewRow[] }> = ({ rows }) => {
    console.log('PreviewTable 렌더링:', { rowsLength: rows.length, rows });
    
    if (rows.length === 0) {
      console.log('PreviewTable: rows가 비어있음, 빈 테이블 표시');
      return (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📋</div>
          <p>표시할 데이터가 없습니다.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
          <thead className="bg-gray-50 dark:bg-gray-600">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                행
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                이름
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                이메일
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                과정
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                데이터 상태
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                사용자 상태
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {rows.map((row, index) => (
              <tr key={`${row.row}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-600">
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
                  {row.row}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {row.id || <span className="text-gray-400 italic">ID 없음</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {row.name || <span className="text-gray-400 italic">이름 없음</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {row.email || <span className="text-gray-400 italic">이메일 없음</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {row.course || <span className="text-gray-400 italic">과정 정보 없음</span>}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      row.status === 'VALID' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {row.status === 'VALID' ? '유효' : '오류'}
                    </span>
                    {row.status === 'INVALID' && row.reason && (
                      <span 
                        className="ml-2 text-gray-400 cursor-help" 
                        title={row.reason}
                      >
                        ⚠️
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      row.userStatus === 'REGISTERED' 
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : row.userStatus === 'UNREGISTERED'
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                    }`}>
                      {row.userStatus === 'REGISTERED' ? '등록된 사용자' : 
                       row.userStatus === 'UNREGISTERED' ? '미등록 사용자' : '상태 불명'}
                    </span>
                    {row.userStatus === 'UNREGISTERED' && (
                      <span 
                        className="ml-2 text-orange-500 cursor-help" 
                        title="회원가입 후 자동으로 문서가 할당됩니다"
                      >
                        📝
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

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

          {/* 2단계: 업로드 결과 */}
          {(() => {
            console.log('조건부 렌더링 확인:', {
              currentStep,
              hasPreviewResult: !!previewResult,
              previewResultKeys: previewResult ? Object.keys(previewResult) : null
            });
            return currentStep === 'result' && previewResult;
          })() && (
            <>
              <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                업로드 결과
              </h3>

                {/* 요약 정보 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {previewResult?.summary?.total || 0}
                    </div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">총 행수</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {previewResult?.summary?.valid || 0}
                </div>
                    <div className="text-sm text-green-600 dark:text-green-400">문서 생성 가능</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {previewResult?.summary?.invalid || 0}
                    </div>
                    <div className="text-sm text-red-600 dark:text-red-400">오류 데이터</div>
                  </div>
                </div>

                {/* 업로드된 데이터 테이블 */}
                {(() => {
                  console.log('테이블 렌더링 전 데이터 확인:', {
                    previewResult,
                    rows: previewResult?.rows,
                    rowsLength: previewResult?.rows?.length,
                    summary: previewResult?.summary
                  });
                  return <PreviewTable rows={previewResult?.rows || []} />;
                })()}

                {/* 안내 메시지 */}
                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
              </div>
                <div>
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        업로드가 완료되었습니다
                  </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                        "확인" 버튼을 클릭한 후 문서 생성 페이지에서 "문서 생성" 버튼을 눌러 실제 문서를 생성하세요.
                      </p>
                    </div>
                  </div>
                </div>
            </div>
            </>
          )}
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          {/* 왼쪽 버튼들 */}
          <div className="flex space-x-3">
            {currentStep === 'result' && previewResult && (
              <button
                onClick={() => {
                  console.log('User clicked re-upload - resetting states');
                  setCurrentStep('upload');
                  setPreviewResult(null);
                  isConfirmedRef.current = false; // ref 리셋
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200"
              >
                다시 업로드
              </button>
            )}
          </div>

          {/* 오른쪽 버튼들 */}
          <div className="flex space-x-3">
            {currentStep === 'upload' && (
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors duration-200"
          >
            닫기
          </button>
            )}
            
            {currentStep === 'result' && previewResult && (
              <button
                onClick={() => {
                  handleUploadComplete();
                  handleClose();
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                확인
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadExcelModal;
