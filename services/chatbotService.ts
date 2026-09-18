import ApiService from './api';

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatFile {
  data: string; // base64
  mimeType: string;
  previewUrl?: string;
  name?: string;
  fileType?: 'image' | 'pdf' | 'excel' | 'csv';
  size?: number;
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'model' | 'system';
  content: string;
  image_data?: string | null;
  tool_calls?: any[];
  tool_responses?: any[];
  created_at?: string;
  loading?: boolean;
  isQueued?: boolean;
}

export interface JobStep {
  type: string;
  message: string;
  toolName?: string;
}

export interface JobStatusResponse {
  status: boolean;
  state?: 'running' | 'completed' | 'failed';
  currentStepText?: string;
  steps?: JobStep[];
  reply?: string;
  toolExecutions?: Array<{ toolName: string; args: any; result: any }>;
  error?: string;
  reason?: string;
}

class ChatbotService {
  /**
   * Fetch all active chat sessions (up to 7-day TTL)
   */
  static async getSessions(): Promise<{ status: boolean; data: ChatSession[]; reason?: string }> {
    try {
      const res = await ApiService.authenticatedRequest('/api/chatbot/sessions', {
        method: 'GET',
      });
      return res || { status: false, data: [] };
    } catch (err: any) {
      console.error('[ChatbotService.getSessions] Error:', err);
      return { status: false, data: [], reason: err?.message || String(err) };
    }
  }

  /**
   * Get messages for a specific session
   */
  static async getSessionMessages(sessionId: string): Promise<{ status: boolean; data: ChatMessage[]; reason?: string }> {
    try {
      const res = await ApiService.authenticatedRequest(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: 'GET',
      });
      return res || { status: false, data: [] };
    } catch (err: any) {
      console.error('[ChatbotService.getSessionMessages] Error:', err);
      return { status: false, data: [], reason: err?.message || String(err) };
    }
  }

  /**
   * Delete a chat session
   */
  static async deleteSession(sessionId: string): Promise<{ status: boolean; reason?: string }> {
    try {
      const res = await ApiService.authenticatedRequest(`/api/chatbot/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
      });
      return res || { status: false };
    } catch (err: any) {
      console.error('[ChatbotService.deleteSession] Error:', err);
      return { status: false, reason: err?.message || String(err) };
    }
  }

  /**
   * Send a message & optional multi-files/images to the AI Assist backend
   */
  static async sendMessage(payload: {
    sessionId?: string | null;
    message: string;
    files?: Array<{ data: string; mimeType: string; fileName?: string; fileType?: string }>;
    images?: Array<{ data: string; mimeType: string }>;
  }): Promise<{ status: boolean; jobId?: string; sessionId?: string; reason?: string }> {
    try {
      const normalizedImages = payload.images && payload.images.length > 0
        ? payload.images
        : (payload.files ? payload.files.filter(f => f.fileType === 'image').map(img => ({
            data: img.data,
            mimeType: img.mimeType
          })) : undefined);

      const res = await ApiService.authenticatedRequest('/api/chatbot/chat', {
        method: 'POST',
        body: JSON.stringify({
          session_id: payload.sessionId || undefined,
          message: payload.message,
          files: payload.files && payload.files.length > 0 ? payload.files.map(f => ({
            data: f.data,
            mimeType: f.mimeType,
            fileName: f.fileName
          })) : undefined,
          images: normalizedImages && normalizedImages.length > 0 ? normalizedImages : undefined,
        }),
      });
      return res || { status: false };
    } catch (err: any) {
      console.error('[ChatbotService.sendMessage] Error:', err);
      return { status: false, reason: err?.message || String(err) };
    }
  }

  /**
   * Poll status of an ongoing background agentic job
   */
  static async pollJobStatus(jobId: string): Promise<JobStatusResponse> {
    try {
      const res = await ApiService.authenticatedRequest(`/api/chatbot/job/${encodeURIComponent(jobId)}`, {
        method: 'GET',
      });
      return res || { status: false };
    } catch (err: any) {
      console.error('[ChatbotService.pollJobStatus] Error:', err);
      return { status: false, reason: err?.message || String(err) };
    }
  }
}

export default ChatbotService;
