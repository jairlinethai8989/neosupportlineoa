export const CACHE_POLICY = {
  reports: {
    dailyPreviewTtlMs: 45_000,
    hubPreviewTtlMs: 30_000,
    dailyResponseCacheControl: 'private, max-age=20, stale-while-revalidate=25',
    hubResponseCacheControl: 'private, max-age=15, stale-while-revalidate=15',
  },
  live: {
    dashboardSummaryTtlMs: 8_000,
    dashboardSummaryWithLogsTtlMs: 4_000,
    dashboardSummaryCacheControl: 'private, max-age=5, stale-while-revalidate=5',
  },
} as const;

