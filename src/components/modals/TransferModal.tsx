'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Users, User, ArrowRight, Loader2 } from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  fromAgentId: string;
  onSuccess: () => void;
}

export default function TransferModal({ isOpen, onClose, ticketId, fromAgentId, onSuccess }: TransferModalProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      async function fetchData() {
        const { data: teamData } = await supabase.from('teams').select('*');
        const { data: agentData } = await supabase.from('profiles').select('*').neq('id', fromAgentId);
        if (teamData) setTeams(teamData);
        if (agentData) setAgents(agentData);
      }
      fetchData();
    }
  }, [isOpen]);

  const handleTransfer = async () => {
    if (!selectedTeam && !selectedAgent) {
       alert('Please select a team or an agent');
       return;
    }
    setLoading(true);
    try {
      const { ticketService } = await import('@/lib/services/ticketService');
      await ticketService.transfer(ticketId, fromAgentId, selectedAgent || undefined, selectedTeam || undefined, reason);
      onSuccess();
      onClose();
    } catch (err) {
      alert('Failed to transfer ticket');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="glass" style={{ width: '480px', padding: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Transfer Ticket</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
           <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Target Team</label>
              <div style={{ position: 'relative' }}>
                 <Users style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={18} />
                 <select 
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 12px 12px 40px', color: 'var(--text-main)', fontSize: '14px' }}>
                    <option value="">Select Team</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                 </select>
              </div>
           </div>

           <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>— OR —</div>

           <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Target Agent</label>
              <div style={{ position: 'relative' }}>
                 <User style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={18} />
                 <select 
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 12px 12px 40px', color: 'var(--text-main)', fontSize: '14px' }}>
                    <option value="">Select Agent</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.full_name || a.username}</option>)}
                 </select>
              </div>
           </div>

           <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Reason for Transfer</label>
              <textarea 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you are transferring this case..."
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', minHeight: '100px' }} 
              />
           </div>

           <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
               onClick={onClose}
               style={{ flex: 1, padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}>
                 Cancel
              </button>
              <button 
                onClick={handleTransfer}
                disabled={loading}
                style={{ flex: 2, padding: '14px', borderRadius: '10px', background: 'var(--secondary)', border: 'none', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: loading ? 0.7 : 1 }}>
                 {loading ? <Loader2 className="animate-spin" size={20} /> : (
                   <>
                    Transfer Now <ArrowRight size={18} />
                   </>
                 )}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
