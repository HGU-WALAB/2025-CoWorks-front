import { TemplateInfo } from '../types/document';

/**
 * PDF 페이지 경로를 파싱하는 유틸리티 함수
 */
export const parsePdfImagePaths = (pdfImagePaths: string): string[] => {
  let parsedPaths: string[] = [];

  // 배열 문자열 형태 "[path1, path2, ...]" 처리 (JSON이 아님)
  if (pdfImagePaths.includes('[') && pdfImagePaths.includes(']')) {
    // 대괄호 제거하고 쉼표로 분리
    const pathString = pdfImagePaths.replace(/[[\]]/g, '');
    parsedPaths = pathString.split(',').map(path => path.trim()).filter(path => path.length > 0);
  }
  // 쉼표로 구분된 문자열
  else if (pdfImagePaths.includes(',')) {
    parsedPaths = pdfImagePaths.split(',').map(path => path.trim()).filter(path => path.length > 0);
  }
  // 단일 경로
  else {
    parsedPaths = [pdfImagePaths.trim()];
  }

  return parsedPaths;
};

/**
 * 템플릿에서 PDF 페이지 경로 목록을 로드하는 함수
 */
export const loadPdfPagesFromTemplate = (template: TemplateInfo | undefined): string[] => {
  if (!template) return [];

  let pages: string[] = [];

  // pdfImagePaths가 있으면 여러 페이지 (항상 PNG 파일)
  if (template.pdfImagePaths && typeof template.pdfImagePaths === 'string') {
    try {
      const parsedPaths = parsePdfImagePaths(template.pdfImagePaths);

      if (Array.isArray(parsedPaths) && parsedPaths.length > 0) {
        pages = parsedPaths.map(path => {
          // ./uploads/ -> /uploads/로 정규화 (pdfImagePaths는 항상 PNG)
          return path.replace(/^\.\//, '/');
        });
      }
    } catch (error) {
      // PDF 페이지 경로 파싱 실패
      // pdfImagePath로 폴백
      if (template.pdfImagePath) {
        const imageFileName = template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
        pages = [`/uploads/pdf-templates/${imageFileName}`];
      }
    }
  }
  // pdfImagePath만 있으면 단일 페이지 (PDF -> PNG 변환)
  else if (template.pdfImagePath) {
    const imageFileName = template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    pages = [`/uploads/pdf-templates/${imageFileName}`];
  }

  return pages;
};

/**
 * 필드들에서 최대 페이지 번호를 찾는 함수
 */
export const getMaxPageFromFields = (fields: any[]): number => {
  if (fields.length === 0) return 1;
  
  const pageNumbers = fields
    .map(field => field.page || 1)
    .filter(page => typeof page === 'number' && page > 0);
  
  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1;
};

/**
 * PDF 페이지 수와 필드 페이지 수를 고려한 총 페이지 수 계산
 */
export const calculateTotalPages = (pdfPages: string[], fields: any[]): number => {
  const pdfPageCount = pdfPages.length;
  const fieldMaxPage = getMaxPageFromFields(fields);
  
  return Math.max(pdfPageCount, fieldMaxPage, 1);
};
