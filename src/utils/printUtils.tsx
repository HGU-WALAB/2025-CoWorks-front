import React from 'react';

// 인쇄용 데이터 타입 정의
export interface PrintField {
  id: string;
  label?: string;
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: string;
  fontSize?: number;
  fontFamily?: string;
  tableData?: {
    rows: number;
    cols: number;
    cells: any[][];
    columnWidths?: number[];
    columnHeaders?: string[];
  };
}

export interface PrintSignatureField {
  id: string;
  reviewerEmail: string;
  reviewerName?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  signatureData?: string;
}

export interface PrintOptions {
  pdfImageUrl: string;
  coordinateFields: PrintField[];
  signatureFields: PrintSignatureField[];
  signatures?: Record<string, string>;
  documentId?: number;
  documentTitle?: string;
}

// 인쇄용 HTML 생성 함수
export const generatePrintHTML = (
  pdfImageUrl: string, 
  fields: PrintField[], 
  signatureFields: PrintSignatureField[], 
  signatures: Record<string, string> = {}
): string => {
  console.log('📝 HTML 생성 시작:', { pdfImageUrl, fieldsCount: fields.length, signatureFieldsCount: signatureFields.length });
  
  const fieldsHTML = fields.map(field => {
    // 필드 타입 확인
    let isTableField = false;
    let isEditorSignature = false;
    let tableInfo = null;
    let tableData = null;

    // 작성자 서명 필드 확인
    if (field.type === 'editor_signature') {
      isEditorSignature = true;
    }
    
    if (field.tableData) {
      isTableField = true;
      tableInfo = field.tableData;
      tableData = field.tableData;
    } else if (field.value) {
      try {
        const parsedValue = JSON.parse(field.value);
        if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
          isTableField = true;
          tableInfo = {
            rows: parsedValue.rows,
            cols: parsedValue.cols,
            columnWidths: parsedValue.columnWidths,
            columnHeaders: parsedValue.columnHeaders || field.tableData?.columnHeaders
          };
          tableData = parsedValue;
        }
      } catch (e) {
        // JSON 파싱 실패 시 일반 필드로 처리
      }
    }
    
    if (isTableField && tableData) {
      console.log('🏁 테이블 HTML 생성:', {
        fieldId: field.id,
        tableData: {
          rows: tableData.rows,
          cols: tableData.cols,
          cells: tableData.cells,
          columnWidths: tableData.columnWidths
        }
      });
      
      // 테이블 HTML 생성 - 개선된 셀 값 추출 로직
      const tableRows = Array(tableInfo!.rows).fill(null).map((_, rowIndex) => {
        const cells = Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
          // 강화된 셀 값 추출 로직
          let cellContent = '';
          try {
            // 1차 시도: 직접 접근
            if (tableData.cells && Array.isArray(tableData.cells)) {
              if (tableData.cells[rowIndex] && Array.isArray(tableData.cells[rowIndex])) {
                const rawValue = tableData.cells[rowIndex][colIndex];
                if (rawValue !== undefined && rawValue !== null) {
                  cellContent = String(rawValue).trim();
                }
              }
            }
            
            // 2차 시도: field.value를 다시 파싱
            if (!cellContent && field.value) {
              try {
                const reparsed = JSON.parse(field.value);
                if (reparsed.cells && Array.isArray(reparsed.cells)) {
                  if (reparsed.cells[rowIndex] && Array.isArray(reparsed.cells[rowIndex])) {
                    const fallbackValue = reparsed.cells[rowIndex][colIndex];
                    if (fallbackValue !== undefined && fallbackValue !== null) {
                      cellContent = String(fallbackValue).trim();
                    }
                  }
                }
              } catch (parseError) {
                console.warn(`📊 필드 값 재파싱 실패 [${rowIndex}][${colIndex}]:`, parseError);
              }
            }
          } catch (error) {
            console.error(`📊 셀 값 추출 실패 [${rowIndex}][${colIndex}]:`, error);
          }
          
          // HTML 이스케이핑 및 빈 값 처리
          const escapedContent = cellContent.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
          const displayContent = escapedContent || '&nbsp;';
          
          const cellWidth = tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`;
          
          console.log(`📊 테이블 셀 [${rowIndex}][${colIndex}]:`, {
            rawValue: tableData.cells?.[rowIndex]?.[colIndex],
            extractedContent: cellContent,
            displayContent: displayContent
          });
          
          return `<td style="
            width: ${cellWidth}; 
            font-size: ${Math.max((field.fontSize || 18) * 0.64, 8)}px; 
            font-family: '${field.fontFamily || 'Arial'}', sans-serif;
            border: 1px solid #000;
            text-align: center;
            vertical-align: middle;
            padding: 2px;
            background: transparent;
            color: black !important;
            font-weight: 500;
            line-height: 1.2;
            box-sizing: border-box;
          ">${displayContent}</td>`;
        }).join('');
        
        return `<tr style="height: ${Math.max(Math.floor((field.height * 0.64) / tableInfo!.rows), 12)}px;">${cells}</tr>`;
      }).join('');
      
      // 열 헤더 행 생성
      const hasColumnHeaders = tableInfo!.columnHeaders && tableInfo!.columnHeaders.some((h: string) => h);
      const headerRow = hasColumnHeaders ? `<thead><tr style="background-color: #e9d5ff;">
        ${Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
          const headerText = tableInfo!.columnHeaders?.[colIndex] || '';
          const cellWidth = tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`;
          const escapedHeader = (headerText || String(colIndex + 1)).replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
          return `<th style="
            width: ${cellWidth};
            font-size: ${Math.max((field.fontSize || 16) * 0.64 * 0.85, 8)}px;
            font-family: '${field.fontFamily || 'Arial'}', sans-serif;
            border: 1px solid #6b21a8;
            text-align: center;
            vertical-align: middle;
            padding: 2px;
            background-color: #e9d5ff;
            color: #6b21a8;
            font-weight: 600;
            line-height: 1.2;
            box-sizing: border-box;
          ">${escapedHeader}</th>`;
        }).join('')}
      </tr></thead>` : '';
      
      return `<div class="table-overlay" style="
        left: ${field.x * 0.64}px; 
        top: ${field.y * 0.64}px; 
        width: ${field.width * 0.64}px; 
        height: ${field.height * 0.64}px;
        position: absolute;
        z-index: 10;
      ">
        <table class="print-table" style="
          width: 100%; 
          height: 100%; 
          border-collapse: collapse; 
          border: 2px solid #000;
          table-layout: fixed;
          background: transparent;
        ">
          ${headerRow}
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
    } else if (isEditorSignature) {
      // 작성자 서명 필드 HTML 생성
      if (field.value && field.value.startsWith('data:image')) {
        return `<div class="editor-signature-overlay" style="
          left: ${field.x * 0.64}px;
          top: ${field.y * 0.64}px;
          width: ${field.width * 0.64}px;
          height: ${field.height * 0.64}px;
          position: absolute;
          z-index: 10;
        ">
          <img src="${field.value}" alt="작성자 서명" class="editor-signature-img" style="
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: transparent;
          " />
        </div>`;
      } else {
        // // 서명이 없는 경우 빈 공간 또는 플레이스홀더
        // return `<div class="editor-signature-placeholder" style="
        //   left: ${field.x * 0.64}px;
        //   top: ${field.y * 0.64}px;
        //   width: ${field.width * 0.64}px;
        //   height: ${field.height * 0.64}px;
        //   position: absolute;
        //   z-index: 10;
        //   border: 1px dashed #ccc;
        //   display: flex;
        //   align-items: center;
        //   justify-content: center;
        //   font-size: ${Math.max((field.fontSize || 12) * 0.64, 8)}px;
        //   color: #666;
        //   background: transparent;
        // ">
        //   작성자 서명
        // </div>`;
      }
    } else {
      // 일반 필드 HTML 생성
      return `<div class="field-overlay" style="left: ${field.x * 0.64}px; top: ${field.y * 0.64}px; width: ${field.width * 0.64}px; height: ${field.height * 0.64}px; font-size: ${(field.fontSize || 18) * 0.64}px; font-family: '${field.fontFamily || 'Arial'}', sans-serif;">${field.value || ''}</div>`;
    }
  }).join('');
  
  // 서명 필드 HTML 생성
  const signaturesHTML = signatureFields.map((field: PrintSignatureField) => {
    const signatureData = field.signatureData || signatures[field.reviewerEmail];

    console.log('🖋️ printUtils - 서명 필드 처리:', {
      fieldId: field.id,
      reviewerEmail: field.reviewerEmail,
      reviewerName: field.reviewerName,
      hasSignatureDataInField: !!field.signatureData,
      hasSignatureDataInSignatures: !!signatures[field.reviewerEmail],
      finalSignatureData: !!signatureData,
      signatureDataLength: signatureData?.length,
      signatureDataPreview: signatureData?.substring(0, 50) + '...'
    });

    return signatureData ? `<div class="signature-overlay" style="left: ${field.x * 0.64}px; top: ${field.y * 0.64}px; width: ${field.width * 0.64}px; height: ${field.height * 0.64}px;">
      <img src="${signatureData}" alt="서명" class="signature-img" />
    </div>` : '';
  }).join('');
  
  console.log('🎨 생성된 필드 HTML:', fieldsHTML.substring(0, 300));
  console.log('✍️ 생성된 서명 HTML:', signaturesHTML.substring(0, 300));
  
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>인쇄 문서</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            margin: 0;
            padding: 20px;
            background: #f0f0f0;
            font-family: Arial, sans-serif;
        }
        
        .preview-container {
            background: white;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            margin: 0 auto;
            position: relative;
        }
        
        .print-container {
            width: 794px;
            height: 1123px;
            position: relative;
            background: white;
            margin: 0 auto;
            overflow: hidden;
        }
        
        .pdf-background {
            width: 100%;
            height: 100%;
            object-fit: fill;
            position: absolute;
            top: 0;
            left: 0;
        }
        
        .field-overlay {
            position: absolute;
            background: transparent;
            color: black;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
            line-height: 1.2;
            padding: 2px;
            overflow: hidden;
            text-align: center;
        }
        
        .table-overlay {
            position: absolute;
            z-index: 10;
        }
        
        .print-table {
            width: 100%;
            height: 100%;
            border-collapse: collapse;
            border: 1px solid black;
        }
        
        .print-table td {
            border: 1px solid black;
            text-align: center;
            vertical-align: middle;
            padding: 4px 2px;
            line-height: 1.2;
            font-weight: 500;
            overflow: hidden;
        }
        
        .signature-overlay {
            position: absolute;
            z-index: 10;
        }
        
        .signature-img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 0;
                background: white;
            }
            
            .preview-container {
                box-shadow: none;
            }
            
            @page {
                size: A4;
                margin: 0;
            }
        }
    </style>
</head>
<body>
    <div class="preview-container">
        <div class="print-container">
            ${pdfImageUrl ? `<img src="${pdfImageUrl}" alt="PDF Background" class="pdf-background" onerror="console.error('PDF 이미지 로드 실패:', this.src)" onload="console.log('PDF 이미지 로드 성공')" />` : '<div style="width: 100%; height: 100%; background: #f9f9f9; display: flex; align-items: center; justify-content: center;">PDF 이미지가 없습니다</div>'}
            ${fieldsHTML}
            ${signaturesHTML}
        </div>
    </div>
    
    <script>
        console.log('📝 인쇄 창 로드됨');
        console.log('PDF URL:', '${pdfImageUrl}');
        console.log('필드 수:', ${fields.length});
        
        // 디버깅용 정보 서비스
        window.addEventListener('load', function() {
            console.log('🎉 인쇄 창 완전 로드 완료');
            
            // PDF 이미지 로드 상태 확인
            const pdfImg = document.querySelector('.pdf-background');
            if (pdfImg) {
                if (pdfImg.complete) {
                    console.log('✅ PDF 이미지 로드 완료');
                } else {
                    console.log('⏳ PDF 이미지 로드 중...');
                }
            } else {
                console.log('⚠️ PDF 이미지 요소를 찾을 수 없음');
            }
            
            // 인쇄 버튼 추가 (디버깅용)
            const printBtn = document.createElement('button');
            printBtn.textContent = '🖨️ 지금 인쇄하기';
            printBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; padding: 10px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;';
            printBtn.onclick = () => window.print();
            document.body.appendChild(printBtn);
        });
    </script>
</body>
</html>`;
};

// 공통 인쇄 함수
export const handlePrint = async (options: PrintOptions): Promise<void> => {
  const { pdfImageUrl, coordinateFields, signatureFields, signatures = {}, documentId, documentTitle = "문서" } = options;
  
  try {
    console.log('🖨️ 인쇄 시작 - 데이터 확인:', {
      documentId,
      documentTitle,
      pdfImageUrl,
      coordinateFieldsCount: coordinateFields.length,
      signatureFieldsCount: signatureFields.length,
      coordinateFields: coordinateFields.map(f => ({
        id: f.id,
        label: f.label,
        value: f.value,
        x: f.x,
        y: f.y,
        hasTableData: !!f.tableData
      })),
      coordinateFieldsWithValues: coordinateFields.filter(f => f.value).length
    });
    
    // PDF 이미지 URL (절대 경로로 변경)
    const fullPdfImageUrl = pdfImageUrl.startsWith('http') ? pdfImageUrl : `${window.location.origin}${pdfImageUrl}`;
    
    console.log('🖨️ 최종 인쇄 데이터:', {
      fullPdfImageUrl,
      coordinateFieldsCount: coordinateFields.length,
      signatureFieldsCount: signatureFields.length,
      coordinateFieldsPreview: coordinateFields.slice(0, 3).map(f => ({ id: f.id, label: f.label, value: f.value }))
    });
    
    // 인쇄용 HTML 생성
    const printContent = generatePrintHTML(fullPdfImageUrl, coordinateFields, signatureFields, signatures);
    
    console.log('📜 인쇄 HTML 내용 미리보기:', printContent.substring(0, 500) + '...');
    
    // 새 창 열고 인쇄
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printContent);
      printWindow.document.close();
      
      // 이미지 로드 완료 대기
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 2000);
      };
    } else {
      alert('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      throw new Error('팝업 차단');
    }
  } catch (error) {
    console.error('인쇄 준비 실패:', error);
    throw error;
  }
};

// React Hook for printing with state management
export const usePrint = () => {
  const [isPrinting, setIsPrinting] = React.useState(false);
  
  const print = React.useCallback(async (options: PrintOptions) => {
    setIsPrinting(true);
    try {
      await handlePrint(options);
    } catch (error) {
      console.error('인쇄 실패:', error);
      throw error;
    } finally {
      setIsPrinting(false);
    }
  }, []);
  
  return { isPrinting, print };
};

// 테이블 셀 값 추출 유틸리티 함수
export const extractTableCellValue = (
  tableData: any, 
  field: PrintField, 
  rowIndex: number, 
  colIndex: number
): string => {
  let cellContent = '';
  
  try {
    // 1차 시도: 직접 접근
    if (tableData.cells && Array.isArray(tableData.cells)) {
      if (tableData.cells[rowIndex] && Array.isArray(tableData.cells[rowIndex])) {
        const rawValue = tableData.cells[rowIndex][colIndex];
        if (rawValue !== undefined && rawValue !== null) {
          cellContent = String(rawValue).trim();
        }
      }
    }
    
    // 2차 시도: field.value를 다시 파싱
    if (!cellContent && field.value) {
      try {
        const reparsed = JSON.parse(field.value);
        if (reparsed.cells && Array.isArray(reparsed.cells)) {
          if (reparsed.cells[rowIndex] && Array.isArray(reparsed.cells[rowIndex])) {
            const fallbackValue = reparsed.cells[rowIndex][colIndex];
            if (fallbackValue !== undefined && fallbackValue !== null) {
              cellContent = String(fallbackValue).trim();
            }
          }
        }
      } catch (parseError) {
        console.warn(`셀 값 재파싱 실패 [${rowIndex}][${colIndex}]:`, parseError);
      }
    }
  } catch (error) {
    console.error(`셀 값 추출 실패 [${rowIndex}][${colIndex}]:`, error);
  }
  
  return cellContent;
};

// DOM 캡처를 통한 새로운 인쇄 함수
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface CaptureToImageOptions {
  elementRef: React.RefObject<HTMLElement | null>;
  documentTitle?: string;
  pdfPageWidth?: number;
  pdfPageHeight?: number;
  backgroundColor?: string;
}

/**
 * 여러 DOM 요소를 캡처하여 하나의 PDF로 합치는 함수
 */
export const captureMultiplePagesToPDF = async (
  pageElements: HTMLElement[],
  documentTitle: string = '문서',
  pdfPageWidth: number = 210,
  pdfPageHeight: number = 297
): Promise<void> => {
  if (!pageElements || pageElements.length === 0) {
    throw new Error('캡처할 페이지가 없습니다.');
  }

  try {

    // PDF 생성
    const pdf = new jsPDF({
      orientation: pdfPageHeight > pdfPageWidth ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [pdfPageWidth, pdfPageHeight]
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // 각 페이지를 순회하며 캡처
    for (let i = 0; i < pageElements.length; i++) {
      const pageElement = pageElements[i];

      // 캡처 옵션 설정
      const captureOptions = {
        backgroundColor: '#ffffff',
        useCORS: true,
        allowTaint: true,
        scale: 3,
        width: pageElement.scrollWidth,
        height: pageElement.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        letterRendering: true,
        logging: false,
        removeContainer: true,
        imageTimeout: 15000,
        onclone: (clonedDoc: Document) => {
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
      };

      // DOM을 캔버스로 캡처
      const canvas = await html2canvas(pageElement, captureOptions);

      // 캔버스를 이미지 데이터로 변환
      const imageData = canvas.toDataURL('image/png');

      // 첫 페이지가 아니면 새 페이지 추가
      if (i > 0) {
        pdf.addPage();
      }

      // 이미지 비율 계산
      const imageAspectRatio = canvas.width / canvas.height;
      const pdfAspectRatio = pdfWidth / pdfHeight;

      let imgWidth = pdfWidth;
      let imgHeight = pdfHeight;

      // 비율에 맞춰 크기 조정
      if (imageAspectRatio > pdfAspectRatio) {
        imgHeight = pdfWidth / imageAspectRatio;
      } else {
        imgWidth = pdfHeight * imageAspectRatio;
      }

      // 이미지를 PDF 중앙에 배치
      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;

      // PDF에 이미지 추가
      pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);
    }

    // PDF 저장
    const filename = `${documentTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);

  } catch (error) {
    throw new Error(`인쇄 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
};

/**
 * DOM 요소를 캡처하여 이미지로 변환 후 PDF로 저장하는 함수
 * 미리보기 모달에서 보이는 내용 그대로를 PDF로 저장
 */
export const captureAndSaveToPDF = async (options: CaptureToImageOptions): Promise<void> => {
  const {
    elementRef,
    documentTitle = '문서',
    pdfPageWidth = 210, // A4 width in mm
    pdfPageHeight = 297, // A4 height in mm
    backgroundColor = '#ffffff'
  } = options;

  if (!elementRef.current) {
    throw new Error('캡처할 요소를 찾을 수 없습니다.');
  }

  try {
    console.log('🖨️ DOM 캡처 인쇄 시작:', {
      elementRef: !!elementRef.current,
      documentTitle,
      pdfPageWidth,
      pdfPageHeight
    });

    // 캡처 옵션 설정
    const captureOptions = {
      backgroundColor,
      useCORS: true,
      allowTaint: true,
      scale: 3, // 고해상도로 캡처 (2 → 3으로 증가)
      width: elementRef.current.scrollWidth,
      height: elementRef.current.scrollHeight,
      scrollX: 0,
      scrollY: 0,
      letterRendering: true, // 텍스트 렌더링 개선
      logging: false,
      removeContainer: true,
      imageTimeout: 15000,
      onclone: (clonedDoc: Document) => {
        // 클론된 문서에서 텍스트 렌더링 최적화
        const clonedElement = clonedDoc.body;
        if (clonedElement) {
          // 모든 텍스트 요소에 렌더링 최적화 스타일 적용
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

    console.log('📸 html2canvas 캡처 옵션:', captureOptions);

    // DOM을 캔버스로 캡처
    const canvas = await html2canvas(elementRef.current, captureOptions);
    
    console.log('✅ 캔버스 캡처 완료:', {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    });

    // 캔버스를 이미지 데이터로 변환
    const imageData = canvas.toDataURL('image/png');

    // PDF 생성
    const pdf = new jsPDF({
      orientation: pdfPageHeight > pdfPageWidth ? 'portrait' : 'landscape',
      unit: 'mm',
      format: [pdfPageWidth, pdfPageHeight]
    });

    // 이미지를 PDF 페이지 크기에 맞게 조정
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    // 이미지 비율 계산
    const imageAspectRatio = canvas.width / canvas.height;
    const pdfAspectRatio = pdfWidth / pdfHeight;
    
    let imgWidth = pdfWidth;
    let imgHeight = pdfHeight;
    
    // 비율에 맞춰 크기 조정
    if (imageAspectRatio > pdfAspectRatio) {
      // 이미지가 더 가로로 길 때
      imgHeight = pdfWidth / imageAspectRatio;
    } else {
      // 이미지가 더 세로로 길 때
      imgWidth = pdfHeight * imageAspectRatio;
    }

    // 이미지를 PDF 중앙에 배치
    const x = (pdfWidth - imgWidth) / 2;
    const y = (pdfHeight - imgHeight) / 2;

    console.log('📄 PDF 이미지 배치:', {
      pdfWidth,
      pdfHeight,
      imgWidth,
      imgHeight,
      x,
      y
    });

    // PDF에 이미지 추가
    pdf.addImage(imageData, 'PNG', x, y, imgWidth, imgHeight);

    // PDF 저장
    const filename = `${documentTitle}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);

    console.log('✅ PDF 저장 완료:', filename);

  } catch (error) {
    console.error('❌ DOM 캡처 인쇄 실패:', error);
    throw new Error(`인쇄 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
  }
};