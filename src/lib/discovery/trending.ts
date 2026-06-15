// Legacy entry point — prefer @/lib/discovery
export {
  fetchGitHubTrending,
  fetchTrending,
  syncTrendingToDb,
  sourceExternalUrl,
  parseTrendingSource,
  SOURCE_LABELS,
} from "./index";
export type { DiscoveryItem } from "./types";
export type { DiscoveryItem as TrendingRepo } from "./types";
