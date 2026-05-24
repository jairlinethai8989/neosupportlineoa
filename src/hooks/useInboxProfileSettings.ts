import { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';
import type { InboxAgent } from '@/types/inbox';

const fallbackModules = [
  'ห้องทำงานแพทย์',
  'ห้องพยาบาล',
  'ห้องยาผู้ป่วยใน',
  'ห้องเวชระเบียน',
  'ห้องผ่าตัด',
  'ห้องวิสัญญี',
  'ห้อง Consult',
  'All',
];

export function useInboxProfileSettings() {
  const { userProfile, companySettings } = useAppContext();
  
  const agent = useMemo(() => userProfile ? (userProfile as InboxAgent) : null, [userProfile]);
  
  const availableModules = useMemo(() => {
    return companySettings?.modules?.length ? companySettings.modules : fallbackModules;
  }, [companySettings]);
  
  const availableIssueTypes = useMemo(() => {
    return companySettings?.issue_types?.length ? companySettings.issue_types : [];
  }, [companySettings]);

  // Using useState for local overrides/updates
  const [personalQuickReplies, setPersonalQuickReplies] = useState<string[]>(
    userProfile?.quick_replies as string[] || []
  );
  
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>(() => {
    if (userProfile?.resolution_templates?.length) {
      return userProfile.resolution_templates as string[];
    }
    const globalTemplates = companySettings?.resolution_templates as unknown[];
    if (globalTemplates?.length) {
      return globalTemplates.map(t => String((t as Record<string, unknown>)?.content || t));
    }
    return [];
  });

  async function updateProfileLists(updates: {
    quickReplies?: string[];
    resolutionTemplates?: string[];
  }) {
    if (!agent?.id) return;

    const payload: Record<string, unknown> = {};

    if (updates.quickReplies) {
      payload.quick_replies = updates.quickReplies;
      setPersonalQuickReplies(updates.quickReplies);
    }

    if (updates.resolutionTemplates) {
      payload.resolution_templates = updates.resolutionTemplates;
      setPersonalResTemplates(updates.resolutionTemplates);
    }

    await supabase.from('profiles').update(payload).eq('id', agent.id);
  }

  async function handleAddCanned() {
    const text = prompt('กรอกข้อความที่ต้องการบันทึกเป็นข้อความส่วนตัว:');
    if (!text?.trim()) return;

    await updateProfileLists({
      quickReplies: [...personalQuickReplies, text.trim()],
    });
  }

  async function handleEditCanned(index: number) {
    const current = personalQuickReplies[index];
    const text = prompt('แก้ไขข้อความส่วนตัว:', current);

    if (!text?.trim() || text === current) return;

    const updated = [...personalQuickReplies];
    updated[index] = text.trim();

    await updateProfileLists({ quickReplies: updated });
  }

  async function handleDeleteCanned(index: number) {
    if (!confirm('ลบข้อความส่วนตัวนี้?')) return;

    await updateProfileLists({
      quickReplies: personalQuickReplies.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  return {
    agent,
    availableModules,
    availableIssueTypes,
    personalQuickReplies,
    personalResTemplates,
    handleAddCanned,
    handleEditCanned,
    handleDeleteCanned,
  };
}
