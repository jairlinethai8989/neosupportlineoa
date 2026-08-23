import { supabase } from '@/lib/supabase';

export type OwnProfileUpdates = {
  full_name?: string;
  avatar_url?: string | null;
  department?: string | null;
  landing_page?: 'dashboard' | 'inbox' | null;
  theme_color?: string | null;
  signature_url?: string | null;
  quick_replies?: string[];
  resolution_templates?: string[];
  auto_logout_minutes?: 0 | 5 | 15 | 30 | 60 | 120;
  status?: 'Active' | 'Away' | 'Offline' | 'Busy';
  last_seen?: true;
  notif_sound_enabled?: boolean;
  notif_sound_mode?: 'beep' | 'beep-retro' | 'beep-cosmic' | 'beep-digital' | 'beep-alert' | 'voice';
  notif_sound_voice?: 'female' | 'male';
  notif_event_new_ticket?: boolean;
  notif_event_new_message?: boolean;
  notif_event_transfer?: boolean;
  notif_event_sla_warning?: boolean;
};

export async function updateOwnProfile(updates: OwnProfileUpdates): Promise<void> {
  const { data, error } = await supabase.rpc('update_own_staff_profile', {
    p_updates: updates,
  });

  if (error) throw error;
  if (data !== true) throw new Error('Profile update was not applied');
}
