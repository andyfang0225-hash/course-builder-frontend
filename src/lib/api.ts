import { supabase } from './supabaseClient';

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error(
    '缺少環境變數 NEXT_PUBLIC_API_URL：請在 frontend/.env.local（或 Vercel）設定後端 API 網址'
  );
}
export const API_BASE_URL = apiUrl;

// 若 access token 剩下不到這麼多毫秒就過期，先主動 refresh。
// Supabase JS 的 auto-refresh 是背景 timer，長時間背景頁籤可能被瀏覽器凍結而沒跑到；
// 我們拿 token 之前自己檢查一次，避免把快過期 / 已過期的 token 送到後端。
const TOKEN_REFRESH_SKEW_MS = 30_000;

function getTokenExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // JWT 用的是 base64url（- 取代 +、_ 取代 /、省略 padding），
    // 瀏覽器 atob 只吃標準 base64，必須先轉換並補齊 padding，
    // 否則遇到特定 token 會 decode 失敗 → 無法主動 refresh → 送出過期 token 被 401。
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string> | null> {
  let { data: { session } } = await supabase.auth.getSession();

  const token = session?.access_token;
  if (token) {
    const expMs = getTokenExpMs(token);
    if (expMs !== null && expMs - Date.now() < TOKEN_REFRESH_SKEW_MS) {
      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (!error && refreshed.session) {
        session = refreshed.session;
      }
    }
  }

  const finalToken = session?.access_token;
  if (!finalToken) return null;
  return { Authorization: `Bearer ${finalToken}` };
}
