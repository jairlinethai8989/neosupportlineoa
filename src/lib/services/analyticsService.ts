import { supabase } from '@/lib/supabase';

export const analyticsService = {
  /**
   * Get Dashboard Overview Stats
   */
  async getOverviewStats() {
    // 1. Total active tickets
    const { count: activeCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'Closed')
      .neq('status', 'Resolved');

    // 2. Resolved today
    const { count: resolvedToday } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Resolved')
      .gte('resolved_at', new Date().toISOString().split('T')[0]);

    // 3. SLA Breached
    const { count: breachedCount } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .lt('sla_due_at', new Date().toISOString())
      .neq('status', 'Resolved')
      .neq('status', 'Closed');

    // 4. Average Response Time (First Response)
    // Formula: AVG(first_response_at - created_at)
    // For now, returning mock or placeholder if complex SQL aggregations are needed
    
    return {
      activeTickets: activeCount || 0,
      resolvedToday: resolvedToday || 0,
      slaBreached: breachedCount || 0,
      avgResponseTime: '12m' // Placeholder
    };
  },

  /**
   * Get SLA Pass/Fail distribution
   */
  async getSLAPerformance() {
     // Queries for pass vs fail
     return [
        { name: 'On Time', value: 85, color: 'var(--success)' },
        { name: 'Breached', value: 15, color: 'var(--danger)' }
     ];
  },

  /**
   * Get category-wise issue distribution
   */
  async getCategoryDistribution() {
     const { data } = await supabase
       .from('tickets')
       .select('category');
     
     // Count occurences
     const counts: Record<string, number> = {};
     data?.forEach(t => {
        const cat = t.category || 'Uncategorized';
        counts[cat] = (counts[cat] || 0) + 1;
     });

     return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }
};
