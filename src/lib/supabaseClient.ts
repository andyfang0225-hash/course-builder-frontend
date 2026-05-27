import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '缺少 Supabase 環境變數：請在 frontend/.env.local 設定 NEXT_PUBLIC_SUPABASE_URL 與 NEXT_PUBLIC_SUPABASE_ANON_KEY'
  );
}

// 用 @supabase/ssr 的 browser client，PKCE code_verifier 會寫到 cookie，
// 這樣 server-side route handler 才能在 OAuth callback 完成 exchangeCodeForSession。
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
