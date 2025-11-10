import React from 'react';
import ReactDOM from 'react-dom/client';
import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { captureAndSaveToPDF } from './printUtils';
import { Document, CoordinateField } from '../types/document';

// 시그니처 필드 타입 정의 (reviewerName을 옵셔널로 변경)
interface SignatureField {
  id: string;
  reviewerEmail: string;
  reviewerName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  signatureData?: string;
}

// 단일 문서 렌더링 컴포넌트
interface DocumentRenderProps {
  pdfImageUrl: string;
  coordinateFields: CoordinateField[];
  signatureFields: SignatureField[];
  onRendered: (element: HTMLDivElement) => void;
}

const DocumentRenderComponent: React.FC<DocumentRenderProps> = ({
  pdfImageUrl,
  coordinateFields,
  signatureFields,
  onRendered
}) => {
  const documentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (documentRef.current) {
      // 컴포넌트가 렌더링된 후 약간의 지연을 두고 콜백 호출
      setTimeout(() => {
        if (documentRef.current) {
          onRendered(documentRef.current);
        }
      }, 500);
    }
  }, [onRendered]);

  return (
    <div 
      ref={documentRef}
      className="relative bg-white shadow-lg select-none"
      style={{
        width: '1240px',
        height: '1754px',
        minWidth: '1240px',
        minHeight: '1754px',
        flexShrink: 0
      }}
    >
      {/* PDF 배경 이미지 */}
      <img 
        src={pdfImageUrl}
        alt="Document Preview"
        className="absolute inset-0 w-full h-full object-contain"
        style={{
          width: '1240px',
          height: '1754px',
          objectFit: 'fill'
        }}
        onError={() => {
          console.error('PDF 이미지 로드 실패:', pdfImageUrl);
        }}
      />
      
      {/* 필드 오버레이 */}
      <div className="absolute inset-0" style={{ width: '1240px', height: '1754px' }}>
        {coordinateFields
          .filter(field => {
            // 작성자 서명 필드는 값이 있는 경우만 표시
            if (field.type === 'editor_signature') {
              return field.value && field.value.trim() !== '';
            }
            // 일반 필드와 테이블 필드는 값이 있는 경우만 표시
            return field.value && field.value.trim() !== '';
          })
          .map((field) => {
          // 필드 타입 확인
          let isTableField = false;
          let isEditorSignature = false;
          let tableInfo = null;
          let tableData = null;

          // 작성자 서명 필드 확인
          if (field.type === 'editor_signature') {
            isEditorSignature = true;
          }
          
          // 테이블 데이터 확인
          if (field.value) {
            try {
              const parsedValue = JSON.parse(field.value);
              if (parsedValue.rows && parsedValue.cols) {
                isTableField = true;
                tableInfo = {
                  rows: parsedValue.rows,
                  cols: parsedValue.cols,
                  columnWidths: parsedValue.columnWidths
                };
                tableData = parsedValue;
              }
            } catch (error) {
              console.error('서버 테이블 데이터 파싱 실패:', error);
            }
          }
          
          if (!isTableField && field.tableData) {
            isTableField = true;
            tableInfo = field.tableData;
            tableData = {
              rows: field.tableData.rows,
              cols: field.tableData.cols,
              cells: Array(field.tableData.rows).fill(null).map(() => 
                Array(field.tableData!.cols).fill('')
              ),
              columnWidths: field.tableData.columnWidths
            };
          }

          return (
            <div
              key={field.id}
              className="absolute"
              style={{
                left: `${field.x}px`,
                top: `${field.y}px`,
                width: `${field.width}px`,
                height: `${field.height}px`,
              }}
            >
              {isEditorSignature ? (
                // 작성자 서명 필드 렌더링
                <div className="w-full h-full p-2 flex flex-col items-center justify-center bg-transparent">
                  {field.value && field.value.startsWith('data:image') ? (
                    <img
                      src={field.value}
                      alt="작성자 서명"
                      className="max-w-full h-full object-contain bg-transparent"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        background: 'transparent'
                      }}
                    />
                  ) : field.value ? (
                    <div
                      className="text-center text-gray-800"
                      style={{
                        fontSize: `${(field.fontSize || 14)}px !important`,
                        fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                        fontWeight: '500 !important',
                        color: '#1f2937 !important'
                      }}
                    >
                      서명됨: {new Date().toLocaleDateString()}
                    </div>
                  ) : null}
                </div>
              ) : isTableField && tableInfo && tableData ? (
                // 테이블 렌더링
                <div className="w-full h-full p-1">
                  <div 
                    className="grid"
                    style={{
                      gridTemplateColumns: tableInfo.columnWidths 
                        ? tableInfo.columnWidths.map((width: number) => `${width * 100}%`).join(' ')
                        : `repeat(${tableInfo.cols}, 1fr)`,
                      height: '100%',
                      gap: '0px'
                    }}
                  >
                    {Array(tableInfo.rows).fill(null).map((_, rowIndex) =>
                      Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                        let cellText = '';
                        
                        try {
                          if (tableData.cells && 
                              Array.isArray(tableData.cells) && 
                              tableData.cells[rowIndex] && 
                              Array.isArray(tableData.cells[rowIndex])) {
                            cellText = tableData.cells[rowIndex][colIndex] || '';
                          }
                        } catch (error) {
                          cellText = '';
                        }

                        return (
                          <div 
                            key={`${rowIndex}-${colIndex}`}
                            className="border border-gray-800 flex items-center justify-center"
                            style={{ 
                              minHeight: '20px',
                              fontSize: `${(field.fontSize || 14)}px !important`,
                              fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                              color: '#1f2937',
                              fontWeight: '500 !important',
                              backgroundColor: 'transparent',
                              lineHeight: '1.4 !important',
                              textAlign: 'center',
                              overflow: 'visible',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                              textRendering: 'optimizeLegibility',
                              WebkitFontSmoothing: 'antialiased',
                              MozOsxFontSmoothing: 'grayscale',
                              padding: '2px 4px'
                            }}
                          >
                            <span 
                              className="text-center truncate leading-tight"
                              style={{
                                display: 'block',
                                width: '100%',
                                fontSize: `${(field.fontSize || 14)}px !important`,
                                fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                fontWeight: '500 !important',
                                color: '#1f2937 !important',
                                lineHeight: '1.4 !important',
                                textAlign: 'center',
                                wordBreak: 'keep-all',
                                whiteSpace: 'nowrap',
                                textRendering: 'optimizeLegibility',
                                WebkitFontSmoothing: 'antialiased',
                                MozOsxFontSmoothing: 'grayscale'
                              }}
                            >
                              {cellText}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : field.value ? (
                // 일반 필드
                <div 
                  className="text-gray-900 flex items-center justify-center w-full h-full"
                  style={{
                    fontSize: `${(field.fontSize || 14)}px !important`,
                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                    fontWeight: '500 !important',
                    color: '#111827 !important',
                    lineHeight: '1.4 !important',
                    textAlign: 'center',
                    wordBreak: 'keep-all',
                    overflow: 'visible',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    whiteSpace: 'nowrap',
                    textRendering: 'optimizeLegibility',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    padding: '2px 4px'
                  }}
                >
                  {field.value}
                </div>
              ) : null}
            </div>
          );
        })}

        {/* 서명 필드 렌더링 */}
        {signatureFields
          .filter(signatureField => signatureField.signatureData)
          .map((signatureField) => (
            <div
              key={signatureField.id}
              className="absolute"
              style={{
                left: `${signatureField.x}px`,
                top: `${signatureField.y}px`,
                width: `${signatureField.width}px`,
                height: `${signatureField.height}px`,
                background: 'transparent',
              }}
            >
              <img
                src={signatureField.signatureData}
                alt={`${signatureField.reviewerName}의 서명`}
                className="w-full h-full object-contain"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%',
                  background: 'transparent'
                }}
              />
            </div>
          ))}
      </div>
    </div>
  );
};

// DOM 요소를 캡처하여 PDF 데이터를 반환하는 함수 (파일 저장 없이)
const captureElementToPDFData = async (element: HTMLElement, documentTitle: string): Promise<Uint8Array> => {
  try {
    console.log('📸 DOM 캡처 시작:', documentTitle);

    // 캡처 옵션 설정
    const captureOptions = {
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: true,
      scale: 3,
      width: element.scrollWidth,
      height: element.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      letterRendering: true,
      logging: false,
      removeContainer: true,
      imageTimeout: 15000,
      onclone: (clonedDoc: any) => {
        const clonedElement = clonedDoc.body;
        if (clonedElement) {
          const style = clonedDoc.createElement('style');
          style.textContent = `
            * {
              -webkit-font-smoothing: antialiased !important;
              -moz-osx-font-smoothing: grayscale !important;
              font-variant-ligatures: none !important;
              text-rendering: optimizeLegibility !important;
              font-feature-settings: "kern" 1 !important;
              line-height: 1.4 !important;
              overflow: visible !important;
            }
            div, span, p, td {
              white-space: nowrap !important;
              overflow: visible !important;
              text-overflow: clip !important;
            }
          `;
          clonedDoc.head.appendChild(style);
        }
      }
    };

    // DOM을 캔버스로 캡처
    const canvas = await html2canvas(element, captureOptions);
    const imageData = canvas.toDataURL('image/png');

    // PDF 생성
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [210, 297] // A4
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const imageAspectRatio = canvas.width / canvas.height;
    const pdfAspectRatio = pdfWidth / pdfHeight;
    
    let imgWidth = pdfWidth;
    let imgHeight = pdfHeight;
    
    if (imageAspectRatio > pdfAspectRatio) {
      imgHeight = pdfWidth / imageAspectRatio;
    } else {
      imgWidth = pdfHeight * imageAspectRatio;
    }

    const x = (pdfWidth - imgWidth) / 2;
    const y = (pdfHeight - imgHeight) / 2;

    pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);

    // PDF 데이터를 Uint8Array로 반환
    const pdfData = pdf.output('arraybuffer');
    return new Uint8Array(pdfData);

  } catch (error) {
    console.error('❌ PDF 데이터 생성 실패:', error);
    throw new Error(`PDF 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
};

// ZIP용 문서 처리 함수 - PDF 데이터를 반환
const processDocumentForZip = async (
  doc: Document,
  getPdfImageUrl: (doc: Document) => string
): Promise<{ filename: string; data: Uint8Array } | null> => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📄 ZIP용 문서 처리 시작: ${doc.title || doc.templateName || '제목 없음'}`);

      // PDF 이미지 URL 생성
      const pdfImageUrl = getPdfImageUrl(doc);
      if (!pdfImageUrl) {
        console.warn(`⚠️ PDF 이미지 URL이 없습니다: ${doc.title}`);
        resolve(null);
        return;
      }

      // 필드 데이터 준비
      let allFields: CoordinateField[] = [];
      if (doc.template?.coordinateFields) {
        try {
          const templateFields = JSON.parse(doc.template.coordinateFields);
          allFields = [...templateFields];
        } catch (error) {
          console.error('템플릿 필드 파싱 오류:', error);
        }
      }

      const savedFields = doc.data?.coordinateFields || [];
      savedFields.forEach((savedField: any) => {
        const existingIndex = allFields.findIndex(field => field.id === savedField.id);
        if (existingIndex >= 0) {
          allFields[existingIndex] = { ...allFields[existingIndex], ...savedField };
        } else {
          allFields.push(savedField);
        }
      });

      // 시그니처 필드를 내부 타입으로 변환
      const signatureFields: SignatureField[] = (doc.data?.signatureFields || []).map(field => ({
        ...field,
        reviewerName: field.reviewerEmail // reviewerEmail을 name으로 사용
      }));

      // 임시 DOM 컨테이너 생성
      const container = window.document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '1240px';
      container.style.height = '1754px';
      container.style.zIndex = '-1';
      window.document.body.appendChild(container);

      // React 컴포넌트 렌더링
      const root = ReactDOM.createRoot(container);
      
      const handleRendered = async (element: HTMLDivElement) => {
        try {
          // 파일명 생성 (ID 없이 기본 이름만)
          const baseName = doc.title || doc.templateName || '제목없음';
          // 파일명에서 특수문자 제거 및 공백을 언더스코어로 변경
          const safeName = baseName
            .replace(/[<>:"/\\|?*]/g, '') // 윈도우에서 금지된 문자들 제거
            .replace(/\s+/g, '_') // 공백을 언더스코어로 변경
            .trim();
          const filename = `${safeName}.pdf`;
          
          // DOM 요소를 PDF 데이터로 변환
          const pdfData = await captureElementToPDFData(element, filename);

          console.log(`✅ ZIP용 문서 처리 완료: ${doc.title || doc.templateName || '제목 없음'}`);

          // 정리
          root.unmount();
          window.document.body.removeChild(container);
          resolve({ filename, data: pdfData });
        } catch (error) {
          console.error(`❌ ZIP용 문서 처리 실패: ${doc.title}`, error);
          // 정리
          root.unmount();
          window.document.body.removeChild(container);
          reject(error);
        }
      };

      // 컴포넌트 렌더링
      root.render(
        <DocumentRenderComponent
          pdfImageUrl={pdfImageUrl}
          coordinateFields={allFields}
          signatureFields={signatureFields}
          onRendered={handleRendered}
        />
      );

    } catch (error) {
      console.error(`❌ ZIP용 문서 처리 실패: ${doc.title}`, error);
      reject(error);
    }
  });
};
const processDocument = async (
  doc: Document,
  getPdfImageUrl: (doc: Document) => string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      console.log(`📄 문서 처리 시작: ${doc.title || doc.templateName || '제목 없음'}`);

      // PDF 이미지 URL 생성
      const pdfImageUrl = getPdfImageUrl(doc);
      if (!pdfImageUrl) {
        console.warn(`⚠️ PDF 이미지 URL이 없습니다: ${doc.title}`);
        resolve();
        return;
      }

      // 필드 데이터 준비
      let allFields: CoordinateField[] = [];
      if (doc.template?.coordinateFields) {
        try {
          const templateFields = JSON.parse(doc.template.coordinateFields);
          allFields = [...templateFields];
        } catch (error) {
          console.error('템플릿 필드 파싱 오류:', error);
        }
      }

      const savedFields = doc.data?.coordinateFields || [];
      savedFields.forEach((savedField: any) => {
        const existingIndex = allFields.findIndex(field => field.id === savedField.id);
        if (existingIndex >= 0) {
          allFields[existingIndex] = { ...allFields[existingIndex], ...savedField };
        } else {
          allFields.push(savedField);
        }
      });

      // 시그니처 필드를 내부 타입으로 변환
      const signatureFields: SignatureField[] = (doc.data?.signatureFields || []).map(field => ({
        ...field,
        reviewerName: field.reviewerEmail // reviewerEmail을 name으로 사용
      }));

      // 임시 DOM 컨테이너 생성
      const container = window.document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      container.style.width = '1240px';
      container.style.height = '1754px';
      container.style.zIndex = '-1';
      window.document.body.appendChild(container);

      // React 컴포넌트 렌더링
      const root = ReactDOM.createRoot(container);
      
      const handleRendered = async (element: HTMLDivElement) => {
        try {
          // DOM 요소 캡처 및 PDF 저장
          await captureAndSaveToPDF({
            elementRef: { current: element },
            documentTitle: doc.title || doc.templateName || `문서_${doc.id}`,
            pdfPageWidth: 210,
            pdfPageHeight: 297,
            backgroundColor: '#ffffff'
          });

          console.log(`✅ 문서 다운로드 완료: ${doc.title || doc.templateName || '제목 없음'}`);

          // 정리
          root.unmount();
          window.document.body.removeChild(container);
          resolve();
        } catch (error) {
          console.error(`❌ 문서 처리 실패: ${doc.title}`, error);
          // 정리
          root.unmount();
          window.document.body.removeChild(container);
          reject(error);
        }
      };

      // 컴포넌트 렌더링 (개별 다운로드용)
      root.render(
        <DocumentRenderComponent
          pdfImageUrl={pdfImageUrl}
          coordinateFields={allFields}
          signatureFields={signatureFields}
          onRendered={handleRendered}
        />
      );

    } catch (error) {
      console.error(`❌ 문서 처리 실패: ${doc.title}`, error);
      reject(error);
    }
  });
};

// 전체 문서 다운로드 함수
export const downloadAllDocuments = async (
  documents: Document[],
  getPdfImageUrl: (doc: Document) => string,
  onProgress?: (current: number, total: number, documentName: string) => void
): Promise<void> => {
  try {
    console.log(`🚀 전체 문서 다운로드 시작: ${documents.length}개 문서`);

    if (documents.length === 0) {
      alert('다운로드할 문서가 없습니다.');
      return;
    }

    // 진행률 알림
    if (onProgress) {
      onProgress(0, documents.length, '준비 중...');
    }

    // 각 문서를 순차적으로 처리
    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];
      const documentName = document.title || document.templateName || `문서_${document.id}`;
      
      try {
        if (onProgress) {
          onProgress(i, documents.length, documentName);
        }

        // 문서 처리
        await processDocument(document, getPdfImageUrl);

        // 문서 간 처리 간격 (브라우저 성능 고려)
        if (i < documents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`문서 처리 실패: ${documentName}`, error);
        // 개별 문서 실패 시에도 계속 진행
        continue;
      }
    }

    if (onProgress) {
      onProgress(documents.length, documents.length, '완료!');
    }

    console.log('✅ 전체 문서 다운로드 완료');
    alert(`총 ${documents.length}개 문서 다운로드가 완료되었습니다.`);

  } catch (error) {
    console.error('❌ 전체 문서 다운로드 실패:', error);
    throw new Error(`전체 문서 다운로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
};

// ZIP으로 묶어서 다운로드하는 함수
export const downloadAllDocumentsAsZip = async (
  documents: Document[],
  getPdfImageUrl: (doc: Document) => string,
  onProgress?: (current: number, total: number, documentName: string) => void
): Promise<void> => {
  try {
    console.log(`📦 ZIP 다운로드 시작: ${documents.length}개 문서`);

    if (documents.length === 0) {
      alert('다운로드할 문서가 없습니다.');
      return;
    }

    // 진행률 알림
    if (onProgress) {
      onProgress(0, documents.length, 'ZIP 파일 준비 중...');
    }

    // ZIP 객체 생성
    const zip = new JSZip();
    const pdfFiles: { filename: string; data: Uint8Array }[] = [];

    // 각 문서를 순차적으로 처리하여 PDF 데이터 수집
    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];
      const documentName = document.title || document.templateName || `문서_${document.id}`;
      
      try {
        if (onProgress) {
          onProgress(i, documents.length, `PDF 생성 중: ${documentName}`);
        }

        // 문서를 PDF 데이터로 변환
        const pdfResult = await processDocumentForZip(document, getPdfImageUrl);
        
        if (pdfResult) {
          pdfFiles.push(pdfResult);
          console.log(`✅ PDF 생성 완료: ${documentName}`);
        }

        // 문서 간 처리 간격 (브라우저 성능 고려)
        if (i < documents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`문서 PDF 생성 실패: ${documentName}`, error);
        // 개별 문서 실패 시에도 계속 진행
        continue;
      }
    }

    if (pdfFiles.length === 0) {
      alert('다운로드 가능한 문서가 없습니다.');
      return;
    }

    // ZIP 파일에 PDF들 추가
    if (onProgress) {
      onProgress(documents.length, documents.length, 'ZIP 파일 생성 중...');
    }

    // 파일명 중복 방지를 위한 Map
    const filenameCount = new Map<string, number>();
    const processedFiles: { finalFilename: string; data: Uint8Array }[] = [];

    // 먼저 모든 파일명을 체크하여 중복 개수 파악
    pdfFiles.forEach(({ filename }) => {
      const count = filenameCount.get(filename) || 0;
      filenameCount.set(filename, count + 1);
    });

    // 각 파일명의 현재 카운터
    const currentCount = new Map<string, number>();

    pdfFiles.forEach(({ filename, data }) => {
      let finalFilename = filename;
      
      // 중복되는 파일명인 경우에만 번호 추가
      if (filenameCount.get(filename)! > 1) {
        const count = (currentCount.get(filename) || 0) + 1;
        currentCount.set(filename, count);
        
        if (count > 1) {
          // 파일명에 (숫자) 형식으로 번호 추가
          const nameWithoutExt = filename.replace('.pdf', '');
          finalFilename = `${nameWithoutExt} (${count}).pdf`;
        }
        // count === 1인 경우는 원본 파일명 그대로 사용
      }
      
      console.log(`📁 ZIP에 추가: ${finalFilename}`);
      processedFiles.push({ finalFilename, data });
    });

    // 최종적으로 ZIP에 파일들 추가
    processedFiles.forEach(({ finalFilename, data }) => {
      zip.file(finalFilename, data);
    });

    // ZIP 파일 생성 및 다운로드
    console.log('📦 ZIP 파일 생성 중...');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // 다운로드 링크 생성
    const url = window.URL.createObjectURL(zipBlob);
    const link = window.document.createElement('a');
    link.href = url;
    
    // 파일명 생성 (현재 날짜 포함)
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS 형식
    link.download = `문서모음_${dateStr}_${timeStr}.zip`;
    
    // 다운로드 실행
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    if (onProgress) {
      onProgress(documents.length, documents.length, '완료!');
    }

    console.log(`✅ ZIP 다운로드 완료: ${pdfFiles.length}개 파일`);
    alert(`총 ${pdfFiles.length}개 문서가 ZIP 파일로 다운로드되었습니다.`);

  } catch (error) {
    console.error('❌ ZIP 다운로드 실패:', error);
    throw new Error(`ZIP 다운로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
};

// React Hook for bulk download
export const useBulkDownload = () => {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [progress, setProgress] = React.useState({ current: 0, total: 0, documentName: '' });

  const download = React.useCallback(async (
    documents: Document[],
    getPdfImageUrl: (doc: Document) => string
  ) => {
    setIsDownloading(true);
    setProgress({ current: 0, total: documents.length, documentName: '준비 중...' });

    try {
      await downloadAllDocuments(
        documents,
        getPdfImageUrl,
        (current, total, documentName) => {
          setProgress({ current, total, documentName });
        }
      );
    } catch (error) {
      console.error('대량 다운로드 실패:', error);
      throw error;
    } finally {
      setIsDownloading(false);
      setProgress({ current: 0, total: 0, documentName: '' });
    }
  }, []);

  const downloadAsZip = React.useCallback(async (
    documents: Document[],
    getPdfImageUrl: (doc: Document) => string
  ) => {
    setIsDownloading(true);
    setProgress({ current: 0, total: documents.length, documentName: 'ZIP 파일 준비 중...' });

    try {
      await downloadAllDocumentsAsZip(
        documents,
        getPdfImageUrl,
        (current, total, documentName) => {
          setProgress({ current, total, documentName });
        }
      );
    } catch (error) {
      console.error('ZIP 다운로드 실패:', error);
      throw error;
    } finally {
      setIsDownloading(false);
      setProgress({ current: 0, total: 0, documentName: '' });
    }
  }, []);

  return { isDownloading, progress, download, downloadAsZip };
};