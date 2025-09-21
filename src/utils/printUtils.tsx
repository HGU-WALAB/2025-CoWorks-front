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

    // 편집자 서명 필드 확인
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
            columnWidths: parsedValue.columnWidths
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
            font-size: ${Math.max((field.fontSize || 14) * 0.64, 8)}px; 
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
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;
    } else if (isEditorSignature) {
      // 편집자 서명 필드 HTML 생성
      if (field.value && field.value.startsWith('data:image')) {
        return `<div class="editor-signature-overlay" style="
          left: ${field.x * 0.64}px;
          top: ${field.y * 0.64}px;
          width: ${field.width * 0.64}px;
          height: ${field.height * 0.64}px;
          position: absolute;
          z-index: 10;
        ">
          <img src="${field.value}" alt="편집자 서명" class="editor-signature-img" style="
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
        //   편집자 서명
        // </div>`;
      }
    } else {
      // 일반 필드 HTML 생성
      return `<div class="field-overlay" style="left: ${field.x * 0.64}px; top: ${field.y * 0.64}px; width: ${field.width * 0.64}px; height: ${field.height * 0.64}px; font-size: ${(field.fontSize || 14) * 0.64}px; font-family: '${field.fontFamily || 'Arial'}', sans-serif;">${field.value || ''}</div>`;
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
            padding: 2px;
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