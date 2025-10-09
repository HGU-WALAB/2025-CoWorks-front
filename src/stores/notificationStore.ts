import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface NotificationData {
  id: number;
  title: string;
  message: string;
  type: 'DOCUMENT_ASSIGNED' | 'DOCUMENT_COMPLETED' | 'DOCUMENT_REJECTED' | 'DOCUMENT_COMMENT' | 'DOCUMENT_DEADLINE' | 'DOCUMENT_UPDATED' | 'SYSTEM_NOTICE';
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
  readAt?: string;
}

interface NotificationStore {
  notifications: NotificationData[];
  unreadCount: number;
  totalCount: number;
  isConnected: boolean;
  sseConnection: EventSource | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: number) => Promise<void>;
  deleteAllNotifications: () => Promise<void>;
  addNotification: (notification: NotificationData & { unreadCount?: number }) => void;
  connectSSE: () => void;
  disconnectSSE: () => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      totalCount: 0,
      isConnected: false,
      sseConnection: null,
      loading: false,
      error: null,

      fetchNotifications: async () => {
        set({ loading: true, error: null });
        
        try {
          const response = await axios.get(`${API_BASE_URL}/notifications`, {
            params: { page: 0, size: 20 }
          });

          set({ 
            notifications: response.data.content || [], 
            totalCount: response.data.totalElements || response.data.content?.length || 0,
            loading: false 
          });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : '알림 조회 중 오류가 발생했습니다.',
            loading: false 
          });
        }
      },

      fetchUnreadCount: async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/notifications/unread/count`);
          set({ unreadCount: response.data.count });
        } catch (error) {
          console.error('읽지 않은 알림 개수 조회 실패:', error);
        }
      },

      markAsRead: async (notificationId: number) => {
        try {
          await axios.put(`${API_BASE_URL}/notifications/${notificationId}/read`);
          
          // 로컬 상태 업데이트
          set((state) => ({
            notifications: state.notifications.map((notif) =>
              notif.id === notificationId
                ? { ...notif, isRead: true, readAt: new Date().toISOString() }
                : notif
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }));
        } catch (error) {
          console.error('알림 읽음 처리 실패:', error);
        }
      },

      markAllAsRead: async () => {
        try {
          await axios.put(`${API_BASE_URL}/notifications/read-all`);
          
          const now = new Date().toISOString();
          set((state) => ({
            notifications: state.notifications.map((notif) => ({
              ...notif,
              isRead: true,
              readAt: now,
            })),
            unreadCount: 0,
          }));
        } catch (error) {
          console.error('모든 알림 읽음 처리 실패:', error);
        }
      },

      addNotification: (notification: NotificationData & { unreadCount?: number }) => {
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: notification.unreadCount !== undefined ? notification.unreadCount : state.unreadCount + 1,
          totalCount: state.totalCount + 1,
        }));
      },

      deleteNotification: async (notificationId: number) => {
        try {
          await axios.delete(`${API_BASE_URL}/notifications/${notificationId}`);
          
          set((state) => {
            const deletedNotification = state.notifications.find(n => n.id === notificationId);
            const newNotifications = state.notifications.filter(n => n.id !== notificationId);
            const unreadCountDecrease = deletedNotification && !deletedNotification.isRead ? 1 : 0;
            
            return {
              notifications: newNotifications,
              totalCount: Math.max(0, state.totalCount - 1),
              unreadCount: Math.max(0, state.unreadCount - unreadCountDecrease),
            };
          });
        } catch (error) {
          console.error('알림 삭제 실패:', error);
        }
      },

      deleteAllNotifications: async () => {
        try {
          await axios.delete(`${API_BASE_URL}/notifications/all`);
          
          set({
            notifications: [],
            totalCount: 0,
            unreadCount: 0,
          });
        } catch (error) {
          console.error('모든 알림 삭제 실패:', error);
        }
      },

      connectSSE: () => {
        const { sseConnection } = get();
        
        if (sseConnection) {
          return; // 이미 연결되어 있음
        }

        try {
          const token = localStorage.getItem('token');
          if (!token) {
            console.error('SSE 연결 실패: 인증 토큰이 없습니다.');
            set({ error: '인증이 필요합니다.' });
            return;
          }

          // URL에 토큰을 쿼리 파라미터로 전달
          const eventSource = new EventSource(
            `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`
          );

          eventSource.onopen = () => {
            console.log('SSE 연결 성공');
            set({ isConnected: true });
          };

          eventSource.addEventListener('connected', (event) => {
            console.log('SSE 연결 확인:', event.data);
          });

          eventSource.addEventListener('notification', (event) => {
            try {
              const data = JSON.parse(event.data);
              const notification: NotificationData & { unreadCount?: number } = {
                id: data.id,
                title: data.title,
                message: data.message,
                type: data.type,
                isRead: false,
                actionUrl: data.actionUrl,
                createdAt: data.createdAt,
                unreadCount: data.unreadCount
              };
              get().addNotification(notification);
              console.log('새로운 알림 수신:', notification);
              console.log('서버에서 제공한 읽지 않은 개수:', data.unreadCount);
            } catch (error) {
              console.error('알림 데이터 파싱 실패:', error);
            }
          });

          eventSource.onerror = (error) => {
            console.error('SSE 연결 오류:', error);
            set({ isConnected: false });
            
            // 재연결 시도 (3초 후)
            setTimeout(() => {
              if (eventSource.readyState === EventSource.CLOSED) {
                get().connectSSE();
              }
            }, 3000);
          };

          set({ sseConnection: eventSource });
        } catch (error) {
          console.error('SSE 연결 실패:', error);
          set({ error: 'SSE 연결에 실패했습니다.' });
        }
      },

      disconnectSSE: () => {
        const { sseConnection } = get();
        
        if (sseConnection) {
          sseConnection.close();
          set({ 
            sseConnection: null, 
            isConnected: false 
          });
          console.log('SSE 연결 종료');
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'notification-store',
    }
  )
);