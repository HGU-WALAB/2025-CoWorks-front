import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';

export const refreshDocumentsAndUser = async (): Promise<void> => {
  try {
    const { refreshUser } = useAuthStore.getState();
    const { fetchDocuments } = useDocumentStore.getState();

    await Promise.allSettled([
      refreshUser().catch(() => undefined),
      fetchDocuments().catch(() => undefined),
    ]);
  } catch (error) {
    console.warn('refreshDocumentsAndUser: unexpected error', error);
  } finally {
    window.dispatchEvent(new Event('forceRefreshDocuments'));
  }
};

