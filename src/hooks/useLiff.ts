'use client';

import { useState, useEffect } from 'react';
import liff from '@line/liff';
import { supabase } from '@/lib/supabase';

export function useLiff() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initLiff() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          setError('LIFF_ID is not configured in environment variables.');
          setLoading(false);
          return;
        }

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const lineProfile = await liff.getProfile();
        setProfile(lineProfile);

        // Sync with Supabase Customers table
        const { data: customer, error: syncError } = await supabase
          .from('customers')
          .select('*')
          .eq('line_user_id', lineProfile.userId)
          .single();

        if (syncError && syncError.code !== 'PGRST116') { // PGRST116 is "No rows found"
          console.error('Supabase sync error:', syncError);
        }

        if (!customer) {
          // Create new customer if they don't exist
          await supabase.from('customers').insert([{
            line_user_id: lineProfile.userId,
            display_name: lineProfile.displayName,
            avatar_url: lineProfile.pictureUrl,
            metadata: { 
              liff_init: true,
              last_seen: new Date().toISOString()
            }
          }]);
        } else {
          // Update existing customer profile
          await supabase.from('customers').update({
            display_name: lineProfile.displayName,
            avatar_url: lineProfile.pictureUrl,
            metadata: { 
              ...customer.metadata,
              last_seen: new Date().toISOString()
            }
          }).eq('line_user_id', lineProfile.userId);
        }

      } catch (err: any) {
        console.error('LIFF Init Error:', err);
        setError(err.message || 'Failed to initialize LIFF');
      } finally {
        setLoading(false);
      }
    }

    initLiff();
  }, []);

  return { profile, loading, error, liff };
}
