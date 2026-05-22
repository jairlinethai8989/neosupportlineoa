import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

type RawTicket = {
  id: string;
  status: string | null;
  created_at: string;
  resolved_at: string | null;
  subject: string | null;
  issue_type: string | null;
  priority: string | null;
  hospitals: { name: string | null } | { name: string | null }[] | null;
};

export type PresentationTicket = {
  id: string;
  subject: string;
  status: string;
  issue_type: string;
  created_at: string;
};

export type HospitalSummary = {
  name: string;
  totalTickets: number;
  resolvedTickets: number;
  tickets: PresentationTicket[];
};

export type PresentationData = {
  dateRange: { start: string; end: string };
  summary: {
    totalTickets: number;
    resolvedTickets: number;
    resolvedRate: number;
    topHospital: { name: string; count: number };
    topCategory: { name: string; count: number };
  };
  categories: { name: string; count: number }[];
  topHospitals: HospitalSummary[];
};

function parseDateParam(value: string | null): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeIssueType(ticket: RawTicket): string {
  const issueType = String(ticket.issue_type || '').trim();
  if (issueType) return issueType;

  const subject = String(ticket.subject || '').trim();
  if (!subject) return 'ไม่ระบุหมวดหมู่';

  const separatorIndex = subject.indexOf(':');
  if (separatorIndex > 0) {
    return subject.slice(0, separatorIndex).trim() || subject;
  }
  return 'อื่นๆ';
}

function getHospitalName(ticket: RawTicket): string {
  const h = ticket.hospitals;
  if (!h) return 'ไม่ระบุโรงพยาบาล';
  if (Array.isArray(h)) {
    return h[0]?.name || 'ไม่ระบุโรงพยาบาล';
  }
  return h.name || 'ไม่ระบุโรงพยาบาล';
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const start = parseDateParam(searchParams.get('start'));
    const end = parseDateParam(searchParams.get('end'));

    if (!start || !end) {
      return NextResponse.json({ error: 'Invalid date format. Expected yyyy-MM-dd.' }, { status: 400 });
    }

    const profileBypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.PROFILE_BYPASS_AUTH === '1';

    if (!profileBypassAuth) {
      const supabaseServer = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabaseServer.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const startIso = `${start}T00:00:00.000Z`;
    const endIso = `${end}T23:59:59.999Z`;

    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select(`
        id,
        status,
        created_at,
        resolved_at,
        subject,
        issue_type,
        priority,
        hospitals!tickets_hospital_id_fkey ( name )
      `)
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rawTickets = (data || []) as RawTicket[];

    // 1. Calculate Overall Summary
    const totalTickets = rawTickets.length;
    let resolvedTickets = 0;

    const categoryCounts: Record<string, number> = {};
    const hospitalGroups: Record<string, { total: number; resolved: number; tickets: PresentationTicket[] }> = {};

    rawTickets.forEach((ticket) => {
      const isResolved = ticket.status === 'Resolved' || ticket.status === 'Closed';
      if (isResolved) resolvedTickets++;

      const category = normalizeIssueType(ticket);
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;

      const hospitalName = getHospitalName(ticket);
      if (!hospitalGroups[hospitalName]) {
        hospitalGroups[hospitalName] = { total: 0, resolved: 0, tickets: [] };
      }
      
      hospitalGroups[hospitalName].total++;
      if (isResolved) hospitalGroups[hospitalName].resolved++;

      // We need up to 10 tickets for the slide presentation
      if (hospitalGroups[hospitalName].tickets.length < 10) {
        hospitalGroups[hospitalName].tickets.push({
          id: ticket.id,
          subject: ticket.subject || '-',
          status: ticket.status || 'New',
          issue_type: category,
          created_at: ticket.created_at,
        });
      }
    });

    const resolvedRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    // 2. Sort Categories
    const categoriesArray = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const topCategory = categoriesArray.length > 0 ? categoriesArray[0] : { name: '-', count: 0 };

    // 3. Sort Hospitals
    const hospitalsArray = Object.entries(hospitalGroups)
      .map(([name, data]) => ({
        name,
        totalTickets: data.total,
        resolvedTickets: data.resolved,
        tickets: data.tickets,
      }))
      .sort((a, b) => b.totalTickets - a.totalTickets);

    const topHospital = hospitalsArray.length > 0 
      ? { name: hospitalsArray[0].name, count: hospitalsArray[0].totalTickets } 
      : { name: '-', count: 0 };

    // 4. Select Top 10 Hospitals for Presentation
    const top10Hospitals = hospitalsArray.slice(0, 10);

    const payload: PresentationData = {
      dateRange: { start, end },
      summary: {
        totalTickets,
        resolvedTickets,
        resolvedRate,
        topHospital,
        topCategory,
      },
      categories: categoriesArray,
      topHospitals: top10Hospitals,
    };

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store', // Always fresh for presentation
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
