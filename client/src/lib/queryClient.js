import { QueryClient } from '@tanstack/react-query'

/** App-wide defaults: refetch when user returns to the tab. */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
      },
    },
  })
}
