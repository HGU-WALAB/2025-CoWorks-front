import { Document } from '../types/document';
import { API_BASE_URL } from '../config/api';

export interface ProcessedSignatureField {
  id: string;
  reviewerEmail: string;
  reviewerName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  signatureData?: string;
}

export interface DocumentPreviewData {
  coordinateFields: any[];
  signatureFields: ProcessedSignatureField[];
  pdfImageUrl: string;
  documentTitle: string;
}

/**
 * 문서 미리보기를 위한 데이터를 준비하는 유틸리티 함수
 */
export const prepareDocumentPreview = (document: Document): DocumentPreviewData => {
  // 템플릿 필드와 저장된 필드를 합쳐서 설정
  let allFields: any[] = [];

  // 템플릿 필드 추가
  if (document.template?.coordinateFields) {
    try {
      const templateFields = JSON.parse(document.template.coordinateFields);
      allFields = [...templateFields];
    } catch (error) {
      console.error('템플릿 필드 파싱 오류:', error);
    }
  }

  // 저장된 추가 필드 추가
  const savedFields = document.data?.coordinateFields || [];
  allFields = [...allFields, ...savedFields];

  // 서명 필드 처리
  const docSignatureFields = document.data?.signatureFields || [];
  const docSignatures = document.data?.signatures || {};

  const processedSignatureFields: ProcessedSignatureField[] = docSignatureFields.map((field: any) => ({
    ...field,
    signatureData: docSignatures[field.reviewerEmail]
  }));

  // PDF 이미지 URL 생성
  const pdfImageUrl = getPdfImageUrl(document);

  // 문서 제목
  const documentTitle = document.title || document.templateName || '제목 없음';

  return {
    coordinateFields: allFields,
    signatureFields: processedSignatureFields,
    pdfImageUrl,
    documentTitle
  };
};

/**
 * PDF 이미지 URL을 생성하는 함수
 */
export const getPdfImageUrl = (document: Document): string => {
  if (!document.template?.pdfImagePath) {
    return '';
  }

  const filename = document.template.pdfImagePath.split('/').pop();
  return `${API_BASE_URL.replace('/api', '')}/api/files/pdf-template-images/${filename}`;
};