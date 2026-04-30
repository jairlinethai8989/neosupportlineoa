'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Users, User, ArrowRight, Loader2 } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticketId: string;
  fromAgentId: string;
  onSuccess: () => void;
}

interface TeamOption {
  id: string;
  name: string | null;
}

interface AgentOption {
  id: string;
  full_name: string | null;
  username: string | null;
}

export default function TransferModal({ isOpen, onClose, ticketId, fromAgentId, onSuccess }: TransferModalProps) {
  const { addToast } = useNotificationContext();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const titleId = useId();
  const teamSelectId = useId();
  const agentSelectId = useId();
  const reasonInputId = useId();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setErrorMessage('');
    setSelectedTeam('');
    setSelectedAgent('');
    setReason('');

    async function fetchData() {
      const [teamResult, agentResult] = await Promise.all([
        supabase.from('teams').select('id, name').order('name'),
        supabase
          .from('profiles')
          .select('id, full_name, username')
          .neq('id', fromAgentId)
          .order('full_name'),
      ]);

      if (cancelled) return;

      if (teamResult.error || agentResult.error) {
        const reasonText = teamResult.error?.message || agentResult.error?.message || 'Failed to load transfer targets';
        setErrorMessage(reasonText);
        addToast({
          id: `transfer-load-failed-${Date.now()}`,
          type: 'ticket',
          title: 'Transfer loading failed',
          body: reasonText,
        });
        return;
      }

      setTeams(teamResult.data || []);
      setAgents(agentResult.data || []);
    }

    void fetchData();
    closeButtonRef.current?.focus();

    return () => {
      cancelled = true;
    };
  }, [isOpen, fromAgentId, addToast]);

  const handleTransfer = async () => {
    if (!selectedTeam && !selectedAgent) {
       const validationMessage = 'Please select a team or an agent.';
       setErrorMessage(validationMessage);
       addToast({
         id: `transfer-validation-${Date.now()}`,
         type: 'ticket',
         title: 'Transfer validation',
         body: validationMessage,
       });
       return;
    }

    setErrorMessage('');
    setLoading(true);
    try {
      const { ticketService } = await import('@/lib/services/ticketService');
      await ticketService.transfer(ticketId, fromAgentId, selectedAgent || undefined, selectedTeam || undefined, reason);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to transfer ticket';
      setErrorMessage(message);
      addToast({
        id: `transfer-failed-${Date.now()}`,
        type: 'ticket',
        title: 'Transfer failed',
        body: message,
      });
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
    }}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div
        className="glass"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{ width: '480px', padding: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 id={titleId} style={{ fontSize: '20px', fontWeight: '800' }}>Transfer Ticket</h2>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close transfer modal"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
           <div>
              <label htmlFor={teamSelectId} style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Target Team</label>
              <div style={{ position: 'relative' }}>
                 <Users style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={18} />
                 <select 
                  id={teamSelectId}
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 12px 12px 40px', color: 'var(--text-main)', fontSize: '14px' }}>
                    <option value="">Select Team</option>
                    {teams.map((team) => <option key={team.id} value={team.id}>{team.name || 'Unnamed Team'}</option>)}
                 </select>
              </div>
           </div>

           <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>— OR —</div>

           <div>
              <label htmlFor={agentSelectId} style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Target Agent</label>
              <div style={{ position: 'relative' }}>
                 <User style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={18} />
                 <select 
                  id={agentSelectId}
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 12px 12px 40px', color: 'var(--text-main)', fontSize: '14px' }}>
                    <option value="">Select Agent</option>
                    {agents.map((agentOption) => (
                      <option key={agentOption.id} value={agentOption.id}>
                        {agentOption.full_name || agentOption.username || 'Unknown Agent'}
                      </option>
                    ))}
                 </select>
              </div>
           </div>

           <div>
              <label htmlFor={reasonInputId} style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Reason for Transfer</label>
              <textarea 
                id={reasonInputId}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why you are transferring this case..."
                style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px', color: 'var(--text-main)', fontSize: '14px', minHeight: '100px' }} 
              />
           </div>
           {errorMessage ? (
            <p role="alert" style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '-4px' }}>
              {errorMessage}
            </p>
           ) : null}

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
