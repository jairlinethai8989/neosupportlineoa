import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const preset = searchParams.get('preset') || 'all'; // 7days, 30days, all
    const hospitalId = searchParams.get('hospitalId');
    let startDate = searchParams.get('startDate');
    let endDate = searchParams.get('endDate');

    const supabase = await createSupabaseServerClient();
    const profileBypassAuth = process.env.NODE_ENV !== 'production' && process.env.PROFILE_BYPASS_AUTH === '1';

    if (!profileBypassAuth) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Determine date range based on preset
    const now = new Date();
    if (!startDate && preset !== 'all') {
      const pastDate = new Date(now);
      if (preset === '7days') pastDate.setDate(now.getDate() - 7);
      if (preset === '30days') pastDate.setDate(now.getDate() - 30);
      startDate = pastDate.toISOString();
    }
    if (!endDate && preset !== 'all') {
      endDate = now.toISOString();
    }

    // Query 1: Top Hospitals
    let hospitalQuery = supabase.from('tickets').select('hospital_id, hospitals(name)');
    if (startDate) hospitalQuery = hospitalQuery.gte('created_at', startDate);
    if (endDate) hospitalQuery = hospitalQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') hospitalQuery = hospitalQuery.eq('hospital_id', hospitalId);
    
    const { data: rawHospitalData, error: hospitalErr } = await hospitalQuery;
    if (hospitalErr) throw hospitalErr;

    // Grouping by hospital
    const hospitalCounts: Record<string, { name: string; count: number }> = {};
    rawHospitalData?.forEach((t: any) => {
      const hid = t.hospital_id;
      if (!hid) return;
      if (!hospitalCounts[hid]) {
        hospitalCounts[hid] = { name: t.hospitals?.name || 'Unknown', count: 0 };
      }
      hospitalCounts[hid].count += 1;
    });
    const topHospitals = Object.values(hospitalCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Query 2: Issue Types
    let issueQuery = supabase.from('tickets').select('issue_type');
    if (startDate) issueQuery = issueQuery.gte('created_at', startDate);
    if (endDate) issueQuery = issueQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') issueQuery = issueQuery.eq('hospital_id', hospitalId);

    const { data: rawIssueData, error: issueErr } = await issueQuery;
    if (issueErr) throw issueErr;

    const issueCounts: Record<string, number> = {};
    rawIssueData?.forEach((t: any) => {
      const issue = t.issue_type || 'ไม่ระบุ';
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    const issueTypes = Object.entries(issueCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    // Query 3: Most Frequent Subjects
    let subjectQuery = supabase.from('tickets').select('subject');
    if (startDate) subjectQuery = subjectQuery.gte('created_at', startDate);
    if (endDate) subjectQuery = subjectQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') subjectQuery = subjectQuery.eq('hospital_id', hospitalId);

    const { data: rawSubjectData, error: subjectErr } = await subjectQuery;
    if (subjectErr) throw subjectErr;

    const subjectCounts: Record<string, number> = {};
    rawSubjectData?.forEach((t: any) => {
      const subject = t.subject || 'ไม่ระบุ';
      subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
    });
    const topSubjects = Object.entries(subjectCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Query 4: Top Hospital Staff
    let staffQuery = supabase.from('tickets').select('customer_id, customers(display_name, hospitals(name))');
    if (startDate) staffQuery = staffQuery.gte('created_at', startDate);
    if (endDate) staffQuery = staffQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') staffQuery = staffQuery.eq('hospital_id', hospitalId);

    const { data: rawStaffData, error: staffErr } = await staffQuery;
    if (staffErr) throw staffErr;

    const staffCounts: Record<string, { name: string; hospital: string; count: number }> = {};
    rawStaffData?.forEach((t: any) => {
      const cid = t.customer_id;
      if (!cid) return;
      if (!staffCounts[cid]) {
        staffCounts[cid] = { 
          name: t.customers?.display_name || 'Unknown', 
          hospital: t.customers?.hospitals?.name || 'Unknown',
          count: 0 
        };
      }
      staffCounts[cid].count += 1;
    });
    const topStaff = Object.values(staffCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Query 5: Heatmap Data
    let heatmapQuery = supabase.from('tickets').select('created_at');
    if (startDate) heatmapQuery = heatmapQuery.gte('created_at', startDate);
    if (endDate) heatmapQuery = heatmapQuery.lte('created_at', endDate);
    if (hospitalId && hospitalId !== 'all') heatmapQuery = heatmapQuery.eq('hospital_id', hospitalId);

    const { data: rawHeatmapData, error: heatmapErr } = await heatmapQuery;
    if (heatmapErr) throw heatmapErr;

    // Process heatmap data: count tickets by day of week (0-6) and hour (0-23)
    const heatmapMatrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    rawHeatmapData?.forEach((t: any) => {
      if (!t.created_at) return;
      const date = new Date(t.created_at);
      const day = date.getDay(); // 0 (Sun) - 6 (Sat)
      const hour = date.getHours();
      heatmapMatrix[day][hour] += 1;
    });
    const heatmapData = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (heatmapMatrix[d][h] > 0) {
          heatmapData.push({ day: d, hour: h, value: heatmapMatrix[d][h] });
        }
      }
    }

    return NextResponse.json({
      topHospitals,
      issueTypes,
      topSubjects,
      topStaff,
      heatmapData
    });

  } catch (error: any) {
    console.error('Error in insights analytics API:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
