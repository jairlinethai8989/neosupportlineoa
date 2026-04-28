export function shouldExposeReportsCacheDebugHeaders(): boolean {
  return process.env.REPORTS_CACHE_DEBUG_HEADERS === '1';
}

