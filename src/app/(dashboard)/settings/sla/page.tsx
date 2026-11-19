'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  ChevronLeft, 
  Save, 
  ShieldCheck, 
  Trash2, 
  Plus,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import type { Priority, SlaRule } from '@/types';

export default function SLASettingsPage() {
  const [rules, setRules] = useState<SlaRule[]>([]);
  const [, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchRules() {
      const { data } = await supabase.from('sla_rules').select('*').order('priority', { ascending: true });
      if (isMounted) {
         setTimeout(() => {
            if (isMounted) {
               setRules(data || []);
               setLoading(false);
            }
         }, 0);
      }
    }
    fetchRules();
    return () => { isMounted = false; };
  }, []);

  const addRule = () => {
    setRules([...rules, { priority: 'Medium', response_time_minutes: 60, resolution_time_minutes: 1440 }]);
  };

  const updateRule = <K extends keyof SlaRule>(index: number, field: K, value: SlaRule[K]) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [field]: value };
    setRules(updated);
  };

  const deleteRule = async (index: number) => {
    const ruleToDelete = rules[index];
    if (ruleToDelete.id) {
       await supabase.from('sla_rules').delete().eq('id', ruleToDelete.id);
    }
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const rule of rules) {
         if (rule.id) {
            await supabase.from('sla_rules').update({ 
               priority: rule.priority, 
               response_time_minutes: rule.response_time_minutes, 
               resolution_time_minutes: rule.resolution_time_minutes 
            }).eq('id', rule.id);
         } else {
            await supabase.from('sla_rules').insert([rule]);
         }
      }
      alert('SLA Rules saved successfully');
    } catch {
      alert('Failed to save rules');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
         <Link href="/analytics" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={24} /></Link>
         <h1 style={{ fontSize: '24px', fontWeight: '800' }}>SLA Configuration</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
               <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Matrix Rules</h2>
               <button onClick={addRule} className="glass-interactive flex-center" style={{ padding: '8px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', gap: '8px' }}>
                  <Plus size={16} /> Add Rule
               </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {rules.map((rule, idx) => (
                  <div key={idx} className="glass" style={{ padding: '20px', display: 'flex', gap: '16px', alignItems: 'end', background: 'rgba(255,255,255,0.02)' }}>
                     <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Priority Level</label>
                        <select 
                           value={rule.priority}
                           onChange={(e) => updateRule(idx, 'priority', e.target.value as Priority)}
                           style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', color: 'white', fontSize: '14px' }}>
                           <option value="Critical">Critical</option>
                           <option value="High">High</option>
                           <option value="Medium">Medium</option>
                           <option value="Low">Low</option>
                        </select>
                     </div>
                     <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>First Response (Min)</label>
                        <input 
                           type="number"
                           value={rule.response_time_minutes}
                           onChange={(e) => updateRule(idx, 'response_time_minutes', parseInt(e.target.value))}
                           style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', color: 'white', fontSize: '14px' }} 
                        />
                     </div>
                     <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Resolution (Min)</label>
                        <input 
                           type="number"
                           value={rule.resolution_time_minutes}
                           onChange={(e) => updateRule(idx, 'resolution_time_minutes', parseInt(e.target.value))}
                           style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px', color: 'white', fontSize: '14px' }} 
                        />
                     </div>
                     <button onClick={() => deleteRule(idx)} className="glass-interactive flex-center" style={{ padding: '10px', borderRadius: '6px', border: 'none', background: 'rgba(234, 84, 85, 0.1)', color: 'var(--danger)' }}>
                        <Trash2 size={18} />
                     </button>
                  </div>
               ))}
               {rules.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No SLA rules defined yet.</p>}
            </div>

            <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
               <button 
                  onClick={handleSave}
                  disabled={saving}
                  className="glass-interactive flex-center" 
                  style={{ 
                     padding: '14px 40px', background: 'var(--primary)', color: '#0a0e14', border: 'none', borderRadius: '10px', fontWeight: '800', gap: '10px', opacity: saving ? 0.7 : 1 
                  }}>
                  {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> Save Configuration</>}
               </button>
            </div>
         </div>

         <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
             <div className="glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                   <ShieldCheck color="var(--primary)" size={18} />
                   <h3 style={{ fontSize: '16px', fontWeight: '700' }}>SLA Policy Guide</h3>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                   Defining SLA rules allows the system to automatically calculate deadlines when a ticket is created. 
                   <br /><br />
                   <strong>Response Time:</strong> Countdown begins the moment a customer sends their first message.
                   <br /><br />
                   <strong>Resolution Time:</strong> The total time allowed to move a ticket to &quot;Resolved&quot; status.
                </p>
             </div>

             <div className="glass" style={{ padding: '24px', border: '1px solid rgba(255, 159, 67, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                   <AlertCircle color="var(--warning)" size={18} />
                   <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Escalation Levels</h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                   Tickets that breach SLA will be highlighted in red on all dashboards and categorized as &quot;Emergency&quot; in your daily reports.
                </p>
             </div>
         </div>
      </div>
    </div>
  );
}
