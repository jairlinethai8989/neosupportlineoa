export const CACHE_POLICY = {
  reports: {
    dailyPreviewTtlMs: 45_000,
    hubPreviewTtlMs: 30_000,
    dailyResponseCacheControl: 'private, max-age=20, stale-while-revalidate=25',
    hubResponseCacheControl: 'private, max-age=15, stale-while-revalidate=15',
  },
  live: {
    dashboardSummaryTtlMs: 30_000,           // was 8s — now 30s to reduce cold-miss frequency
    dashboardSummaryWithLogsTtlMs: 15_000,   // was 4s — now 15s
    dashboardSummaryCacheControl: 'private, max-age=20, stale-while-revalidate=20',
  },
} as const;


