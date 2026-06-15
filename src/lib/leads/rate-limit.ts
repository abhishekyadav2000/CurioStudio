const scanTimestamps: number[] = [];
const WINDOW_MS = 60_000;
const MAX_SCANS_PER_WINDOW = 6;

export function checkScanRateLimit(): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  while (scanTimestamps.length > 0 && scanTimestamps[0] < now - WINDOW_MS) {
    scanTimestamps.shift();
  }
  if (scanTimestamps.length >= MAX_SCANS_PER_WINDOW) {
    const retryAfterMs = scanTimestamps[0] + WINDOW_MS - now;
    return { allowed: false, retryAfterMs: Math.max(1000, retryAfterMs) };
  }
  scanTimestamps.push(now);
  return { allowed: true };
}
