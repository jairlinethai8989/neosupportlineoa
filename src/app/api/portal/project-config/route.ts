import { NextResponse } from 'next/server';
import {
  resolveProjectById,
  resolveProjectBySlug,
  toProjectPublicConfig,
} from '@/lib/projects/projectResolver';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('project');
    const ticketId = searchParams.get('ticketId');

    let project = null;

    if (!slug && ticketId) {
      const { data: ticketRow } = await supabaseAdmin
        .from('tickets')
        .select('project_id')
        .eq('id', ticketId)
        .maybeSingle();

      if (ticketRow?.project_id) {
        project = await resolveProjectById(ticketRow.project_id);
      }
    }

    if (!project) {
      project = await resolveProjectBySlug(slug);
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const publicConfig = toProjectPublicConfig(project);
    const realProjectId = project.id === 'default-env-fallback' ? null : project.id;

    let orgQuery = supabaseAdmin
      .from('organizations')
      .select('id, name, abbreviation, project_id')
      .order('name', { ascending: true });

    let subjectQuery = supabaseAdmin
      .from('ticket_subject_types')
      .select('id, name, project_id')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (realProjectId) {
      orgQuery = orgQuery.eq('project_id', realProjectId);
      subjectQuery = subjectQuery.or(`project_id.is.null,project_id.eq.${realProjectId}`);
    }

    const [{ data: organizations }, { data: subjectTypes }] = await Promise.all([
      orgQuery,
      subjectQuery,
    ]);

    return NextResponse.json({
      project: publicConfig,
      organizations: organizations || [],
      subjectTypes: (subjectTypes || []).map((item) => item.name),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load project config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
