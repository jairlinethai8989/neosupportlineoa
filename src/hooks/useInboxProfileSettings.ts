import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getInboxCompanySettings, getInboxProfile } from '@/lib/inbox/queries';
import type { InboxAgent, InboxCompanySettings } from '@/types/inbox';

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
  const [agent, setAgent] = useState<InboxAgent | null>(null);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);
  const [personalQuickReplies, setPersonalQuickReplies] = useState<string[]>([]);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>([]);

  useEffect(() => {
    async function loadProfileSettings() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const resolvedAgent = await getInboxProfile(user.id);

        setAgent(resolvedAgent);
        setPersonalQuickReplies(resolvedAgent?.quick_replies || []);
        setPersonalResTemplates(resolvedAgent?.resolution_templates || []);
      }

      const typedCompanyData: InboxCompanySettings = await getInboxCompanySettings();

      if (typedCompanyData.modules?.length) {
        setAvailableModules(typedCompanyData.modules);
      } else {
        setAvailableModules(fallbackModules);
      }

      if (typedCompanyData.issue_types?.length) {
        setAvailableIssueTypes(typedCompanyData.issue_types);
      }
    }

    loadProfileSettings();
  }, []);

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
