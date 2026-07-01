import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // Let supabase-js process the OAuth redirect (?code) itself. getSession()
      // awaits that processing, so the session is ready before we route.
      detectSessionInUrl: true,
    },
  },
)
