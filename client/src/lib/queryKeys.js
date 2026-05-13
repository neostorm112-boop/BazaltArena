/** Centralized React Query keys for consistent invalidation. */
export const queryKeys = {
  me: () => ['me'],
  /** Hall of fame + sprint tabs (server list order). */
  hall: (sortBy) => ['hall', sortBy],
}
