import ApiService from '../api';
import {
  IChatTemplate,
  IChatTemplateGroup,
  IGetChatTemplatesResponse,
} from '../../screens/ecommerce/chat/types/chat.types';

export interface INormalizedChatTemplates {
  groups: IChatTemplateGroup[];
  templates: IChatTemplate[];
  ungrouped: IChatTemplate[];
}

/**
 * Normalizes backend response into consistent groups, flat templates list, and ungrouped templates
 */
export const normalizeChatTemplates = (response: any): INormalizedChatTemplates => {
  if (!response) {
    return { groups: [], templates: [], ungrouped: [] };
  }

  let rawGroups: any[] = [];
  let rawTemplates: any[] = [];
  let rawUngrouped: any[] = [];

  // Check if data is nested under .data
  const root = response.data && typeof response.data === 'object' && !Array.isArray(response.data)
    ? response.data
    : response;

  if (Array.isArray(root.groups)) {
    rawGroups = root.groups;
  }
  if (Array.isArray(root.templates)) {
    rawTemplates = root.templates;
  } else if (Array.isArray(response.data)) {
    rawTemplates = response.data;
  }
  if (Array.isArray(root.ungrouped)) {
    rawUngrouped = root.ungrouped;
  }

  // Map individual template object to clean IChatTemplate
  const cleanTemplate = (item: any, defaultGroupId?: any, defaultGroupName?: any): IChatTemplate => {
    return {
      id: item.id ?? item._id ?? String(Math.random()),
      group_id: item.group_id ?? defaultGroupId ?? null,
      group_name: item.group_name ?? defaultGroupName ?? null,
      title: item.title || item.name || item.shortcut || 'Template',
      shortcut: item.shortcut || (item.title ? `/${item.title.toLowerCase().replace(/\s+/g, '_')}` : ''),
      content: item.content || item.message || item.text || '',
      sort_order: typeof item.sort_order === 'number' ? item.sort_order : 0,
    };
  };

  // Process groups and their templates
  const processedGroups: IChatTemplateGroup[] = rawGroups.map((g: any) => {
    const groupTemplates: IChatTemplate[] = Array.isArray(g.templates)
      ? g.templates.map((t: any) => cleanTemplate(t, g.id, g.name))
      : [];

    groupTemplates.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return {
      id: g.id ?? String(Math.random()),
      name: g.name || g.title || 'Grup',
      sort_order: typeof g.sort_order === 'number' ? g.sort_order : 0,
      templates: groupTemplates,
    };
  });

  processedGroups.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  // Process ungrouped templates
  const processedUngrouped: IChatTemplate[] = rawUngrouped.map((t: any) => cleanTemplate(t, null, null));

  // Process flat templates list
  let processedTemplates: IChatTemplate[] = [];

  if (rawTemplates.length > 0) {
    processedTemplates = rawTemplates.map((t: any) => cleanTemplate(t));
  } else {
    // If backend only provided groups & ungrouped, synthesize flat list
    const fromGroups = processedGroups.flatMap((g) => g.templates);
    processedTemplates = [...fromGroups, ...processedUngrouped];
  }

  // If backend provided only a flat list without groups, build groups from group_id / group_name
  if (processedGroups.length === 0 && processedTemplates.length > 0) {
    const groupMap = new Map<string | number, IChatTemplateGroup>();
    const standaloneUngrouped: IChatTemplate[] = [];

    processedTemplates.forEach((tpl) => {
      if (tpl.group_id) {
        const gId = tpl.group_id;
        const gName = tpl.group_name || `Grup ${gId}`;
        if (!groupMap.has(gId)) {
          groupMap.set(gId, {
            id: gId,
            name: gName,
            sort_order: 0,
            templates: [],
          });
        }
        groupMap.get(gId)!.templates.push(tpl);
      } else {
        standaloneUngrouped.push(tpl);
      }
    });

    if (groupMap.size > 0) {
      processedGroups.push(...Array.from(groupMap.values()));
    }
    if (processedUngrouped.length === 0 && standaloneUngrouped.length > 0) {
      processedUngrouped.push(...standaloneUngrouped);
    }
  }

  return {
    groups: processedGroups,
    templates: processedTemplates,
    ungrouped: processedUngrouped,
  };
};

/**
 * Fetch chat templates from backend API
 */
export const fetchChatTemplates = async (): Promise<INormalizedChatTemplates> => {
  console.log('📋 [chatTemplateService] Fetching chat templates...');

  let response: IGetChatTemplatesResponse | null = null;

  // Try standard GET endpoints
  try {
    response = await ApiService.authenticatedRequest('/get/ecommerce/chat/templates', {
      method: 'GET',
    });
  } catch (err: any) {
    console.warn('⚠️ [chatTemplateService] /get/ecommerce/chat/templates failed, trying /api/ecommerce/chat/templates:', err?.message);
    try {
      response = await ApiService.authenticatedRequest('/api/ecommerce/chat/templates', {
        method: 'GET',
      });
    } catch (fallbackErr: any) {
      console.warn('⚠️ [chatTemplateService] /api/ecommerce/chat/templates failed, trying /ecommerce/chat/templates:', fallbackErr?.message);
      response = await ApiService.authenticatedRequest('/ecommerce/chat/templates', {
        method: 'GET',
      });
    }
  }

  console.log('📋 [chatTemplateService] Response received:', {
    status: response?.status ?? response?.success,
    hasGroups: !!response?.groups,
    hasTemplates: !!response?.templates,
  });

  return normalizeChatTemplates(response);
};

/**
 * Expands any shortcuts within the given text using the available templates.
 * Examples:
 * - "/halo" -> "Halo! Terima kasih sudah menghubungi kami..."
 * - "/HALO" -> "Halo! Terima kasih sudah menghubungi kami..."
 * - "Halo kak /ongkir ya" -> "Halo kak Ongkos kirim dihitung berdasarkan lokasi... ya"
 */
export const expandShortcuts = (inputText: string, templates: IChatTemplate[]): string => {
  if (!inputText || !templates || templates.length === 0) {
    return inputText || '';
  }

  const trimmed = inputText.trim();
  const trimmedLower = trimmed.toLowerCase();

  // 1. Exact match for whole input (e.g. "/halo", "halo", "/HALO")
  const exactMatch = templates.find((t) => {
    if (!t.shortcut && !t.title) return false;
    const sc = (t.shortcut || '').toLowerCase();
    const scWithoutSlash = sc.startsWith('/') ? sc.slice(1) : sc;
    const title = (t.title || '').toLowerCase();

    return (
      sc === trimmedLower ||
      `/${scWithoutSlash}` === trimmedLower ||
      scWithoutSlash === trimmedLower.replace(/^\//, '') ||
      `/${title}` === trimmedLower
    );
  });

  if (exactMatch && exactMatch.content) {
    return exactMatch.content;
  }

  // 2. Inline shortcut expansion for patterns like /(?:^|\s)(\/[a-zA-Z0-9_\u00C0-\u024F-]+)/g
  let expanded = inputText;
  const sortedTemplates = [...templates].sort((a, b) => (b.shortcut?.length || 0) - (a.shortcut?.length || 0));

  for (const tpl of sortedTemplates) {
    if (!tpl.shortcut || !tpl.content) continue;
    const sc = tpl.shortcut.startsWith('/') ? tpl.shortcut : `/${tpl.shortcut}`;
    const escapedSc = sc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|\\s)${escapedSc}(?=\\s|[.,!?;:]|$)`, 'gi');
    expanded = expanded.replace(regex, `$1${tpl.content}`);
  }

  return expanded;
};
