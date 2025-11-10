export interface ReviewerSignatureField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  reviewerEmail?: string | null;
  reviewerName?: string | null;
  page?: number;
  value?: string | null;
  [key: string]: unknown;
}

export const getReviewerSignatureFields = (
  coordinateFields: any[] = []
): ReviewerSignatureField[] => {
  return coordinateFields
    .filter(field => {
      if (!field) return false;
      const fieldType = String(field.type || '').toLowerCase();
      return fieldType === 'reviewer_signature';
    })
    .map(field => ({
      ...field,
      signatureData: field.value ?? null,
    }));
};

export const hasReviewerSigned = (
  coordinateFields: any[] = [],
  email?: string | null
): boolean => {
  if (!email) return false;
  return coordinateFields.some(field => {
    if (!field) return false;
    const fieldType = String(field.type || '').toLowerCase();
    if (fieldType !== 'reviewer_signature') return false;
    return (
      field.reviewerEmail === email &&
      field.value !== null &&
      field.value !== undefined &&
      String(field.value).trim() !== ''
    );
  });
};

