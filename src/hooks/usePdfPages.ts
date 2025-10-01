import { useState, useEffect, useCallback, useMemo } from 'react';
import { TemplateInfo } from '../types/document';
import { loadPdfPagesFromTemplate, calculateTotalPages } from '../utils/pdfPageLoader';

/**
 * PDF 페이지 관리를 위한 커스텀 훅
 */
export const usePdfPages = (
  template: TemplateInfo | undefined,
  coordinateFields: any[] = []
) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pdfPages, setPdfPages] = useState<string[]>([]);

  // template의 pdfImagePath와 pdfImagePaths만 의존성으로 사용
  const pdfImagePath = template?.pdfImagePath;
  const pdfImagePaths = template?.pdfImagePaths;

  // PDF 페이지 로드 함수 - template 변경 시에만 실행
  const loadPdfPages = useCallback(() => {
    if (!template) return;

    // 분리된 유틸리티 함수 사용
    const pages = loadPdfPagesFromTemplate(template);
    setPdfPages(pages);

    // 초기에는 PDF 페이지 수만 사용
    const initialTotalPages = pages.length || 1;
    setTotalPages(initialTotalPages);

    // 현재 페이지가 총 페이지를 초과하면 1페이지로 리셋
    setCurrentPage(prev => prev > initialTotalPages ? 1 : prev);
  }, [template, pdfImagePath, pdfImagePaths]);

  // PDF 페이지 데이터 로드
  useEffect(() => {
    loadPdfPages();
  }, [loadPdfPages]);

  /**
   * 페이지 변경 핸들러
   */
  const goToPage = useCallback((pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  }, [totalPages]);

  /**
   * 다음 페이지로 이동
   */
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  }, [currentPage, totalPages]);

  /**
   * 이전 페이지로 이동
   */
  const previousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  }, [currentPage]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    pdfPages,
    loadPdfPages,
    goToPage,
    nextPage,
    previousPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1
  };
};
