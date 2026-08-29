import { useState, useEffect, useCallback } from 'react';
import {
  IChatTemplate,
  IChatTemplateGroup,
  IUseChatTemplatesReturn,
} from '../types/chat.types';
import { fetchChatTemplates } from '../../../../services/ecommerce/chatTemplateService';

/**
 * Custom hook for managing chat templates and groups
 */
export const useChatTemplates = (): IUseChatTemplatesReturn => {
  const [groups, setGroups] = useState<IChatTemplateGroup[]>([]);
  const [templates, setTemplates] = useState<IChatTemplate[]>([]);
  const [ungrouped, setUngrouped] = useState<IChatTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplatesData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📱 [useChatTemplates] Loading chat templates...');

      const result = await fetchChatTemplates();

      setGroups(result.groups);
      setTemplates(result.templates);
      setUngrouped(result.ungrouped);

      console.log('✅ [useChatTemplates] Templates loaded:', {
        groupsCount: result.groups.length,
        totalTemplates: result.templates.length,
        ungroupedCount: result.ungrouped.length,
      });
    } catch (err: any) {
      console.error('❌ [useChatTemplates] Error loading templates:', err);
      setError(err?.message || 'Gagal memuat template chat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplatesData();
  }, [fetchTemplatesData]);

  return {
    groups,
    templates,
    ungrouped,
    loading,
    error,
    refresh: fetchTemplatesData,
  };
};
