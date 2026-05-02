import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const akey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Lazy singleton — only created when first called, never on the server
let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    _client = createClient(url, akey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        },
      },
    })
  }
  return _client
}

// Keep named export for compatibility — same lazy init
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string|symbol, unknown>)[prop]
  },
})

export function adminClient() {
  const skey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, skey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
