export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    HISNET_LOGIN: '/auth/login',
    ME: '/auth/me',
  },
  DOCUMENTS: {
    BASE: '/documents',
    BY_ID: (id: number | string) => `/documents/${id}`,
    FIELD_VALUES: (id: number | string) => `/documents/${id}/field-values`,
    START_EDITING: (id: number | string) => `/documents/${id}/start-editing`,
    COMPLETE_EDITING: (id: number | string) => `/documents/${id}/complete-editing`,
    SUBMIT_FOR_REVIEW: (id: number | string) => `/documents/${id}/submit-for-review`,
    ASSIGN_EDITOR: (id: number | string) => `/documents/${id}/assign-editor`,
    ASSIGN_REVIEWER: (id: number | string) => `/documents/${id}/assign-reviewer`,
    DOWNLOAD_PDF: (id: number | string) => `/documents/${id}/download-pdf`,
    BULK_PREVIEW: '/documents/bulk/preview',
    BULK_COMMIT: '/documents/bulk/commit',
    BULK_CANCEL: '/documents/bulk/cancel',
    BULK_STAGING_ITEMS: (stagingId: string) => `/documents/bulk/staging/${stagingId}/items`,
  },
  TEMPLATES: {
    BASE: '/templates',
    BY_ID: (id: number | string) => `/templates/${id}`,
  },
  PDF: {
    CONVERT_TO_IMAGE: '/pdf/convert-to-image',
  },
} as const;