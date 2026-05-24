'use client';

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown, { type Components } from 'react-markdown';
import mermaid from 'mermaid';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import WhiteboardDashboard from '@/components/WhiteboardDashboard';
import NoteWorkspace from '@/components/NoteWorkspace';
import PaywallModal from '@/components/PaywallModal';
import { API_BASE_URL, getAuthHeaders } from '@/lib/api';

mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });

function Mermaid({ chart }: { chart: string }) {
  const rawId = useId();
  const id = `mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [svg, setSvg] = useState('');
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 先用 parse(suppressErrors:true) 預檢查；無效時回 false（而非噴錯 + 注入炸彈 SVG）
        const isValid = await mermaid.parse(chart, { suppressErrors: true });
        if (!isValid) {
          if (!cancelled) { setHasError(true); setSvg(''); }
          return;
        }
        const result = await mermaid.render(id, chart);
        // 最後防護：若 Mermaid 仍回傳錯誤圖示的 SVG，當作錯誤處理
        if (!result?.svg || /aria-roledescription="error"|class="error-icon"/.test(result.svg)) {
          if (!cancelled) { setHasError(true); setSvg(''); }
          return;
        }
        if (!cancelled) { setSvg(result.svg); setHasError(false); }
      } catch {
        if (!cancelled) { setHasError(true); setSvg(''); }
      }
    })();
    return () => { cancelled = true; };
  }, [chart, id]);

  if (hasError) {
    return (
      <div className="my-4">
        <div className="p-4 border border-red-300 bg-red-50 text-red-700 text-sm">
          ⚠️ 圖表語法有誤，已降級顯示為純文字。
        </div>
        <pre className="mt-2 border border-gray-300 bg-gray-50 p-3 text-xs overflow-x-auto">
          <code>{chart}</code>
        </pre>
      </div>
    );
  }
  if (!svg) return <div className="my-4 text-sm text-gray-500">圖表繪製中...</div>;
  return <div className="my-4 flex justify-center border border-gray-200 bg-white p-3 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />;
}

interface Message { role: 'user' | 'assistant'; content: string; }
interface CourseModule {
  module_title: string;
  detailed_content: string;
  key_takeaways: string | string[];
}
interface CourseData {
  course_title: string;
  introduction: string;
  modules: CourseModule[];
  conclusion: string;
  next_learning_steps: string;
  references?: string[];
}
const INITIAL_CONSULTANT_MSG: Message = {
  role: 'assistant',
  content: '你好，我是課程企劃顧問。你想學習什麼新知識或技能？我們可以先討論一下課綱。',
};
const INITIAL_TA_MSG: Message = {
  role: 'assistant',
  content: '你好，我是隨堂助教。閱讀左側講義時有任何疑問，請隨時問我。',
};

const MARKDOWN_COMPONENTS: Components = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:bg-black hover:text-white"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const lang = match?.[1];
    const raw = String(children).replace(/\n$/, '');
    if (lang === 'mermaid') {
      return <Mermaid chart={raw} />;
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

export default function CourseBuilder() {
  const [phase, setPhase] = useState<'chat' | 'course'>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('思考中...');

  const [messages, setMessages] = useState<Message[]>([INITIAL_CONSULTANT_MSG]);
  const [inputValue, setInputValue] = useState('');

  // 課綱面板狀態
  const [isSyllabusPanelOpen, setIsSyllabusPanelOpen] = useState(false);
  const [courseTopic, setCourseTopic] = useState('');
  const [chapters, setChapters] = useState<{ id: number; title: string }[]>([{ id: 1, title: '' }]);
  const [teachingStyle, setTeachingStyle] = useState('條理');

  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState('');

  // 頂層視圖切換
  const [currentView, setCurrentView] = useState<'courses' | 'whiteboards'>('courses');
  const [selectedWhiteboardId, setSelectedWhiteboardId] = useState<string | null>(null);

  // 歷史紀錄
  interface HistoryItem { id: string; course_title: string; created_at: string; }
  const [historyCourses, setHistoryCourses] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Auth
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // 頁面剛載入時無法立即知道有沒有 session，會先 true 顯示載入畫面避免「登入狀態 → 登入頁」的閃爍。
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  // 登入頁的「我已閱讀並同意服務條款」勾選狀態。未勾選 → 登入按鈕 disabled。
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 使用者方案狀態
  interface UserPlan { is_premium: boolean; course_count: number; free_limit: number; }
  const [userPlan, setUserPlan] = useState<UserPlan | null>(null);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setHistoryCourses([]);
  };

  const handleUpgrade = async () => {
    const headers = await getAuthHeaders();
    if (!headers) { alert('請先登入再升級'); return; }
    try {
      const res = await fetch(`${API_BASE_URL}/api/create-ecpay-order`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      const { action_url, params }: {
        action_url: string;
        params: Record<string, string | number>;
      } = await res.json();

      // 動態建立隱藏表單 → submit 跳轉綠界（URL 由後端決定，切換測試/正式環境只要改後端 env）
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = action_url;
      form.style.display = 'none';
      Object.entries(params).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = String(v);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`建立訂單失敗：${msg}`);
    }
  };
  const [showAssistant, setShowAssistant] = useState(true);
  const [taMessages, setTaMessages] = useState<Message[]>([INITIAL_TA_MSG]);
  const [taInput, setTaInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const taChatEndRef = useRef<HTMLDivElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const syllabusFileInputRef = useRef<HTMLInputElement>(null);
  // 目前進行中的串流；切換對話 / 組件卸載時用來取消，避免伺服端持續生成。
  const streamAbortRef = useRef<AbortController | null>(null);

  // 元件卸載時取消任何尚在進行的串流
  useEffect(() => {
    const ref = streamAbortRef;
    return () => { ref.current?.abort(); };
  }, []);

  const isAbortError = (err: unknown): boolean =>
    err instanceof DOMException && err.name === 'AbortError';

  // 上傳檔案（聊天／課綱面板各一）
  const [selectedChatFile, setSelectedChatFile] = useState<File | null>(null);
  const [selectedSyllabusFile, setSelectedSyllabusFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');

  const clearChatFile = () => {
    setSelectedChatFile(null);
    if (chatFileInputRef.current) chatFileInputRef.current.value = '';
  };
  const clearSyllabusFile = () => {
    setSelectedSyllabusFile(null);
    if (syllabusFileInputRef.current) syllabusFileInputRef.current.value = '';
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { taChatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [taMessages]);

  const fetchUserPlan = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/plan`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: UserPlan = await res.json();
      setUserPlan(data);
    } catch (err) {
      console.error('讀取方案狀態失敗', err);
    }
  }, []);

  const fetchHistoryCourses = useCallback(async () => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/courses`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HistoryItem[] = await res.json();
      setHistoryCourses(data);
    } catch (err) {
      console.error('讀取歷史紀錄失敗', err);
    }
  }, []);

  // 攔截所有會帶付費 gate 的 API：後端回 403 + FREE_LIMIT_REACHED / PREMIUM_FEATURE_* 時自動開 paywall。
  // 回 true 代表已經處理，呼叫端應儘早 return。用 res.clone() 以免吃掉 body。
  const openPaywallIfGated = async (res: Response): Promise<boolean> => {
    if (res.status !== 403) return false;
    const payload = await res
      .clone()
      .json()
      .catch(() => ({} as { detail?: unknown }));
    const code = typeof payload?.detail === 'string' ? payload.detail : '';
    if (code === 'FREE_LIMIT_REACHED' || code.startsWith('PREMIUM_FEATURE_')) {
      fetchUserPlan();
      setIsPaywallOpen(true);
      return true;
    }
    return false;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCurrentUser(data.session?.user ?? null);
      setIsAuthChecking(false);
    });
    // onAuthStateChange 也可能搶先觸發（例如 OAuth 剛回來時），兩個 handler 任一個結束都視為檢查完畢。
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setCurrentUser(newSession?.user ?? null);
      setIsAuthChecking(false);
    });
    return () => { authListener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchHistoryCourses();
      fetchUserPlan();
    } else {
      setHistoryCourses([]);
      setUserPlan(null);
    }
  }, [currentUser, fetchHistoryCourses, fetchUserPlan]);

  const handleGenerateTextNote = async () => {
    // 免費版直接引導升級；後端 /to-note 也有 require_premium 作為第二道防線
    if (!userPlan?.is_premium) {
      setIsPaywallOpen(true);
      return;
    }
    if (!courseId) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    setIsLoading(true);
    setLoadingText('AI 助教正在為您萃取課程精華...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/courses/${courseId}/to-note`, {
        method: 'POST',
        headers,
      });
      if (await openPaywallIfGated(res)) return;
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCurrentView('whiteboards');
      setSelectedWhiteboardId(data.whiteboard_id);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`生成失敗：${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteCourse = async (id: string, title: string) => {
    if (!confirm(`確定要刪除「${title || '(未命名課程)'}」嗎？此操作無法復原。`)) return;
    const headers = await getAuthHeaders();
    if (!headers) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/courses/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      setHistoryCourses((prev) => prev.filter((c) => c.id !== id));
      // 若刪到的剛好是當前顯示的課程，退回聊天階段
      if (courseId === id) handleReset();
      fetchUserPlan();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`刪除失敗：${msg}`);
    }
  };

  const loadCourse = async (courseId: string) => {
    const headers = await getAuthHeaders();
    if (!headers) return;
    setIsLoading(true);
    setLoadingText('讀取歷史課程中...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/courses/${courseId}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCourseData(data.course_data);
      setCourseId(data.id ?? null);
      setMarkdownContent(data.markdown || '');
      setTaMessages([INITIAL_TA_MSG]);
      setPhase('course');
      setIsHistoryOpen(false);
    } catch (err) {
      console.error(err);
      alert('讀取課程失敗');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    const prompt = inputValue.trim();
    if (!prompt || isLoading) return;
    const userMsg: Message = { role: 'user', content: prompt };
    const baseMessages = [...messages, userMsg];
    setMessages([...baseMessages, { role: 'assistant', content: '' }]);
    setInputValue('');
    setIsLoading(true);
    setLoadingText('顧問思考中...');
    // 若前一次串流還沒結束就中止，避免兩個串流競爭覆蓋同一個 message
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    try {
      const headers = await getAuthHeaders();
      if (!headers) { setIsLoading(false); return; }
      const form = new FormData();
      form.append('messages', JSON.stringify(baseMessages));
      form.append('new_prompt', prompt);
      if (selectedChatFile) form.append('file', selectedChatFile);
      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: form,
        signal: controller.signal,
      });
      if (await openPaywallIfGated(res)) {
        setMessages(baseMessages); // 丟掉剛加進去的空氣泡
        return;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (firstChunk) { setIsLoading(false); firstChunk = false; }
        setMessages([...baseMessages, { role: 'assistant', content: accumulated }]);
      }
      accumulated += decoder.decode();
      setMessages([...baseMessages, { role: 'assistant', content: accumulated || '（沒有回覆）' }]);
      clearChatFile();
    } catch (err) {
      if (isAbortError(err)) return; // 使用者主動取消（切換對話 / 離開頁面），不要蓋錯誤訊息
      console.error(err);
      setMessages([...baseMessages, { role: 'assistant', content: '⚠️ 連線失敗，請確認後端 (127.0.0.1:8000) 是否啟動。' }]);
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setIsLoading(false);
    }
  };

  const addChapter = () => {
    setChapters((prev) => [...prev, { id: (prev[prev.length - 1]?.id ?? 0) + 1, title: '' }]);
  };

  const removeChapter = (id: number) => {
    setChapters((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));
  };

  const updateChapter = (id: number, title: string) => {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  };

  const handleGenerateCourse = async () => {
    const validChapters = chapters.map((c) => c.title.trim()).filter(Boolean);
    if (!courseTopic.trim() || validChapters.length === 0) return;
    const syllabus =
      `主題：${courseTopic.trim()}\n` +
      validChapters.map((t, i) => `第${i + 1}章：${t}`).join('\n');
    setIsLoading(true); setLoadingText('正在依據您的課綱與風格撰寫講義，並建構助教大腦...');
    try {
      const headers = await getAuthHeaders();
      if (!headers) { setIsLoading(false); return; }
      const form = new FormData();
      form.append('syllabus', syllabus);
      form.append('teaching_style', teachingStyle);
      if (selectedSyllabusFile) form.append('file', selectedSyllabusFile);
      // 防呆：免費版即使 state 殘留值（例如先升級又退級、或從升級頁返回），都不送出 video_url
      if (videoUrl.trim() && userPlan?.is_premium) {
        form.append('video_url', videoUrl.trim());
      }
      const res = await fetch(`${API_BASE_URL}/api/generate-course`, {
        method: 'POST',
        headers,
        body: form,
      });
      if (await openPaywallIfGated(res)) {
        // FREE_LIMIT_REACHED 或 PREMIUM_FEATURE_FILE_UPLOAD：關掉課綱面板並開 paywall
        setIsLoading(false);
        setIsSyllabusPanelOpen(false);
        return;
      }
      if (res.status === 503 || res.status === 502) {
        // 503：Gemini 真的繁忙；502：Gemini 回了無效 JSON。對使用者來說「重試」就對了
        const detail = await res.json().catch(() => ({}));
        alert(detail.detail || '模型服務目前繁忙或回應格式錯誤，請稍後再試。');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.course_data) {
        setCourseData(data.course_data);
        setCourseId(data.course_id ?? null);
        setMarkdownContent(data.markdown);
        setIsSyllabusPanelOpen(false);
        setPhase('course');
        clearSyllabusFile();
        setVideoUrl('');
        fetchHistoryCourses();
        fetchUserPlan();
      }
    } catch (err) {
      console.error(err);
      alert("生成課程失敗");
    } finally { setIsLoading(false); }
  };

  const handleTaMessage = async () => {
    const question = taInput.trim();
    if (!question || isLoading) return;
    const userMsg: Message = { role: 'user', content: question };
    const baseTaMessages = [...taMessages, userMsg];
    setTaMessages([...baseTaMessages, { role: 'assistant', content: '' }]);
    setTaInput('');
    setIsLoading(true);
    setLoadingText('助教查閱講義中...');
    streamAbortRef.current?.abort();
    const controller = new AbortController();
    streamAbortRef.current = controller;
    try {
      const headers = await getAuthHeaders();
      if (!headers) { setIsLoading(false); return; }
      const res = await fetch(`${API_BASE_URL}/api/ta-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ question, course_id: courseId, history: baseTaMessages }),
        signal: controller.signal,
      });
      if (await openPaywallIfGated(res)) {
        setTaMessages(baseTaMessages);
        return;
      }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let firstChunk = true;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        if (firstChunk) { setIsLoading(false); firstChunk = false; }
        setTaMessages([...baseTaMessages, { role: 'assistant', content: accumulated }]);
      }
      accumulated += decoder.decode();
      setTaMessages([...baseTaMessages, { role: 'assistant', content: accumulated || '（沒有回覆）' }]);
    } catch (err) {
      if (isAbortError(err)) return;
      console.error(err);
      setTaMessages([...baseTaMessages, { role: 'assistant', content: '⚠️ 助教連線失敗。' }]);
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setPhase('chat');
    setMessages([INITIAL_CONSULTANT_MSG]);
    setCourseTopic('');
    setChapters([{ id: 1, title: '' }]);
    setTeachingStyle('條理');
    setVideoUrl('');
    setIsSyllabusPanelOpen(false);
    setCourseData(null); setCourseId(null); setMarkdownContent(''); setTaMessages([INITIAL_TA_MSG]);
  };

  // === 驗證身分中：避免閃爍出登入頁，顯示滿版 loading ===
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-white text-black font-sans flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-bold text-lg">正在驗證身分...</p>
      </div>
    );
  }

  // === 未登入：強制導到專屬登入畫面，完全不渲染主 UI ===
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white text-black font-sans flex flex-col selection:bg-black selection:text-white">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6 border-2 border-black p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold tracking-wider">專屬課程建構室</h1>
            <p className="text-sm md:text-base text-gray-700 leading-relaxed">
              請先登入以開始規劃您的專屬課程與 AI 助教
            </p>

            {/* 同意條款勾選：必勾才能啟用登入按鈕。
                e.stopPropagation 防止點擊「服務條款」連結時順便切換 checkbox（label htmlFor 預設會代為觸發）。 */}
            <div className="flex items-start gap-2 text-sm text-left leading-relaxed">
              <input
                id="agree-tos"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 cursor-pointer accent-black"
              />
              <label htmlFor="agree-tos" className="cursor-pointer">
                我已閱讀並同意{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="underline font-bold hover:bg-black hover:text-white"
                >
                  服務條款
                </Link>
                {' '}與{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="underline font-bold hover:bg-black hover:text-white"
                >
                  隱私權政策
                </Link>
              </label>
            </div>

            <button
              onClick={handleSignIn}
              disabled={!agreedToTerms}
              className="w-full border-2 border-black bg-black text-white px-6 py-3 text-base font-bold hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              title={!agreedToTerms ? '請先勾選同意服務條款' : undefined}
            >
              Google 登入
            </button>
          </div>
        </div>

        <footer className="border-t border-black p-4 text-center text-xs text-gray-600">
          <Link href="/terms" target="_blank" className="mx-2 hover:underline">
            服務條款
          </Link>
          <span aria-hidden="true">・</span>
          <Link href="/privacy" target="_blank" className="mx-2 hover:underline">
            隱私權政策
          </Link>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <header className="border-b-2 border-black p-4 flex justify-between items-center sticky top-0 bg-white z-50">
        <div className="flex items-center gap-4">
          <h1 className="font-bold text-xl tracking-wider">專屬課程建構室</h1>
          <nav className="flex items-center border-2 border-black">
            <button
              onClick={() => { setCurrentView('courses'); setSelectedWhiteboardId(null); }}
              className={`px-3 py-1 text-sm font-bold transition ${currentView === 'courses' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
            >
              我的課程
            </button>
            <button
              onClick={() => {
                if (!userPlan?.is_premium) {
                  setIsPaywallOpen(true);
                  return;
                }
                setCurrentView('whiteboards');
              }}
              className={`px-3 py-1 text-sm font-bold transition border-l-2 border-black ${currentView === 'whiteboards' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
              title={!userPlan?.is_premium ? '升級專業版以解鎖筆記/白板' : undefined}
            >
              {!userPlan?.is_premium && '👑 '}我的筆記
            </button>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {/* 走到這裡代表已登入（未登入者在 early return 被導去專屬登入畫面），不需要再渲染登入按鈕 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 hidden md:inline max-w-[160px] truncate" title={currentUser.email ?? ''}>
              {currentUser.email}
            </span>
            {userPlan?.is_premium ? (
              <span className="text-xs font-bold bg-yellow-300 text-black border-2 border-black px-2 py-1">
                ⭐ 專業版
              </span>
            ) : (
              <button
                onClick={() => setIsPaywallOpen(true)}
                className="text-xs font-bold border-2 border-black bg-white text-black px-2 py-1 hover:bg-yellow-300 transition"
                title="點擊升級"
              >
                免費版{userPlan ? ` (${userPlan.course_count}/${userPlan.free_limit} 本月)` : ''}
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-sm font-bold border border-black px-4 py-1 hover:bg-black hover:text-white transition"
            >
              登出
            </button>
          </div>
          {currentView === 'courses' && phase === 'course' && (
            <button
              onClick={() => setShowAssistant(!showAssistant)}
              className="text-sm font-bold border border-black px-4 py-1 hover:bg-black hover:text-white transition"
            >
              {showAssistant ? '隱藏助教' : '顯示助教'}
            </button>
          )}
          {currentView === 'courses' && (
            <>
              <button
                onClick={() => setIsHistoryOpen(true)}
                className="text-sm font-bold border border-black px-4 py-1 hover:bg-black hover:text-white transition"
              >
                歷史紀錄{historyCourses.length > 0 && ` (${historyCourses.length})`}
              </button>
              <button onClick={handleReset} className="text-sm font-bold border border-black px-4 py-1 hover:bg-black hover:text-white transition">重啟課程</button>
            </>
          )}
          {currentView === 'whiteboards' && selectedWhiteboardId && (
            <button
              onClick={() => setSelectedWhiteboardId(null)}
              className="text-sm font-bold border border-black px-4 py-1 hover:bg-black hover:text-white transition"
            >
              ← 返回列表
            </button>
          )}
        </div>
      </header>

      {/* ================= 歷史紀錄側邊欄 ================= */}
      {isHistoryOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-[55]"
            onClick={() => setIsHistoryOpen(false)}
          />
          <aside className="fixed top-0 left-0 bottom-0 w-full md:w-[400px] bg-white border-r-2 border-black z-[60] flex flex-col shadow-[8px_0_24px_-8px_rgba(0,0,0,0.15)]">
            <div className="border-b-2 border-black p-4 flex justify-between items-center bg-black text-white shrink-0">
              <h2 className="font-bold tracking-wider">歷史紀錄</h2>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-sm font-bold border border-white px-3 py-1 hover:bg-white hover:text-black transition"
              >
                關閉
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {historyCourses.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  尚無歷史紀錄<br />生成第一堂課後會顯示於此。
                </div>
              ) : (
                <ul>
                  {historyCourses.map((h) => (
                    <li key={h.id} className="border-b border-black flex">
                      <button
                        onClick={() => loadCourse(h.id)}
                        className="flex-1 text-left p-4 hover:bg-gray-100 transition"
                      >
                        <div className="font-bold line-clamp-2">{h.course_title || '(未命名課程)'}</div>
                        <div className="text-xs text-gray-500 mt-1 font-mono">
                          {new Date(h.created_at).toLocaleString('zh-TW', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </button>
                      <button
                        onClick={() => deleteCourse(h.id, h.course_title)}
                        className="shrink-0 px-4 border-l border-black text-sm font-bold text-red-600 hover:bg-red-600 hover:text-white transition"
                        aria-label="刪除課程"
                        title="刪除課程"
                      >
                        刪除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t-2 border-black p-3 shrink-0">
              <button
                onClick={fetchHistoryCourses}
                className="w-full border-2 border-black bg-white p-2 text-sm font-bold hover:bg-black hover:text-white transition"
              >
                重新整理
              </button>
            </div>
          </aside>
        </>
      )}

      <main className="max-w-6xl mx-auto p-4 md:p-8">
        {isLoading && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="font-bold text-lg animate-pulse">{loadingText}</p>
          </div>
        )}

        {/* ================= 階段一：聊天需求 ================= */}
        {currentView === 'courses' && phase === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto">
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] border-2 border-black p-3 whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="mt-4 border-t-2 border-black pt-4 flex flex-col gap-2">
              {selectedChatFile && (
                <div className="flex items-center gap-2 text-sm border-2 border-black bg-gray-100 px-3 py-1">
                  <span className="font-mono">📎 {selectedChatFile.name}</span>
                  <span className="text-gray-500">({Math.round(selectedChatFile.size / 1024)} KB)</span>
                  <button
                    onClick={clearChatFile}
                    className="ml-auto font-bold hover:bg-black hover:text-white px-2"
                    aria-label="取消選取"
                  >
                    ✕
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                {userPlan?.is_premium ? (
                  <label className="border-2 border-black bg-white px-3 font-bold hover:bg-black hover:text-white transition cursor-pointer flex items-center" title="附加圖片或 PDF">
                    <input
                      ref={chatFileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setSelectedChatFile(e.target.files?.[0] ?? null)}
                    />
                    📎
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPaywallOpen(true)}
                    className="border-2 border-black bg-white px-3 text-xs font-bold hover:bg-black hover:text-white transition"
                    title="升級專業版以附加檔案"
                  >
                    👑 升級專業版以附加檔案
                  </button>
                )}
                <input type="text" className="flex-1 border-2 border-black p-3 outline-none focus:bg-gray-50" placeholder="輸入您的需求..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} />
                <button onClick={handleSendMessage} className="border-2 border-black bg-white px-8 font-bold hover:bg-black hover:text-white transition">送出</button>
              </div>
              <button
                onClick={() => setIsSyllabusPanelOpen(true)}
                className="w-full border-2 border-black bg-black text-white p-3 font-bold hover:bg-gray-800 transition"
              >
                開啟課綱設定面板
              </button>
            </div>
          </div>
        )}

        {/* ================= 課綱設定側邊面板 (phase === 'chat' 時可開) ================= */}
        {currentView === 'courses' && phase === 'chat' && isSyllabusPanelOpen && (
          <aside className="fixed top-0 right-0 bottom-0 w-full md:w-[480px] lg:w-[520px] bg-white border-l-2 border-black z-[60] flex flex-col shadow-[-8px_0_24px_-8px_rgba(0,0,0,0.15)]">
            <div className="border-b-2 border-black p-4 flex justify-between items-center bg-black text-white shrink-0">
              <h2 className="font-bold tracking-wider">設定課程細節</h2>
              <button
                onClick={() => setIsSyllabusPanelOpen(false)}
                className="text-sm font-bold border border-white px-3 py-1 hover:bg-white hover:text-black transition"
              >
                關閉
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* 1. 課程主題 */}
              <div className="space-y-2">
                <label className="font-bold block">1. 課程主題</label>
                <p className="text-xs text-gray-600">一句話描述這堂課要教什麼。</p>
                <input
                  type="text"
                  className="w-full border-2 border-black p-3 outline-none focus:bg-gray-50"
                  placeholder="例如：RESTful API 入門"
                  value={courseTopic}
                  onChange={(e) => setCourseTopic(e.target.value)}
                />
              </div>

              {/* 2. 章節清單 */}
              <div className="space-y-2">
                <label className="font-bold block">2. 課程章節</label>
                <p className="text-xs text-gray-600">逐章填寫標題，可隨時新增或刪除。</p>
                <div className="space-y-2">
                  {chapters.map((ch, idx) => (
                    <div key={ch.id} className="flex gap-2 items-center">
                      <span className="font-mono text-sm w-6 shrink-0 text-gray-500">{idx + 1}.</span>
                      <input
                        type="text"
                        className="flex-1 border-2 border-black p-2 outline-none focus:bg-gray-50"
                        placeholder={`第 ${idx + 1} 章標題`}
                        value={ch.title}
                        onChange={(e) => updateChapter(ch.id, e.target.value)}
                      />
                      <button
                        onClick={() => removeChapter(ch.id)}
                        disabled={chapters.length <= 1}
                        className="border-2 border-black px-3 py-2 text-sm font-bold hover:bg-black hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="刪除章節"
                      >
                        刪除
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={addChapter}
                  className="w-full border-2 border-dashed border-black p-2 font-bold text-sm hover:bg-gray-100 transition mt-2"
                >
                  + 新增章節
                </button>
              </div>
            </div>

            {/* 底部：檔案 + 風格 + 生成 */}
            <div className="border-t-2 border-black p-4 space-y-3 bg-white shrink-0">
              <div className="space-y-2">
                <label className="font-bold text-sm block">參考檔案（選填）</label>
                {selectedSyllabusFile ? (
                  <div className="flex items-center gap-2 text-sm border-2 border-black bg-gray-100 px-3 py-1">
                    <span className="font-mono truncate">📎 {selectedSyllabusFile.name}</span>
                    <span className="text-gray-500 shrink-0">({Math.round(selectedSyllabusFile.size / 1024)} KB)</span>
                    <button
                      onClick={clearSyllabusFile}
                      className="ml-auto font-bold hover:bg-black hover:text-white px-2"
                      aria-label="取消選取"
                    >
                      ✕
                    </button>
                  </div>
                ) : userPlan?.is_premium ? (
                  <label className="w-full border-2 border-dashed border-black p-2 font-bold text-sm hover:bg-gray-100 transition cursor-pointer flex justify-center items-center">
                    <input
                      ref={syllabusFileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setSelectedSyllabusFile(e.target.files?.[0] ?? null)}
                    />
                    📎 附加圖片或 PDF
                  </label>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPaywallOpen(true)}
                    className="w-full border-2 border-dashed border-black p-2 font-bold text-sm hover:bg-gray-100 transition cursor-pointer flex justify-center items-center"
                  >
                    👑 升級專業版以附加檔案
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-bold text-sm block">YouTube 影片（選填）</label>
                <p className="text-xs text-gray-600">貼上影片網址，AI 會抓取字幕作為參考。</p>
                {userPlan?.is_premium ? (
                  <input
                    type="url"
                    inputMode="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full border-2 border-black p-2 text-sm font-mono outline-none focus:bg-gray-50"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPaywallOpen(true)}
                    className="w-full border-2 border-dashed border-black p-2 font-bold text-sm hover:bg-gray-100 transition cursor-pointer flex justify-center items-center"
                  >
                    👑 升級專業版以匯入 YouTube 影片字幕
                  </button>
                )}
              </div>
              <div className="space-y-2">
                <label className="font-bold text-sm block">授課風格</label>
                <div className="grid grid-cols-4 gap-2">
                  {['條理', '輕鬆', '簡單介紹', '專業講解'].map((style) => (
                    <label
                      key={style}
                      className={`border-2 border-black p-2 cursor-pointer flex justify-center items-center font-bold text-xs transition-colors ${teachingStyle === style ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
                    >
                      <input
                        type="radio"
                        name="teachingStyle"
                        value={style}
                        checked={teachingStyle === style}
                        onChange={(e) => setTeachingStyle(e.target.value)}
                        className="hidden"
                      />
                      {style}
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGenerateCourse}
                disabled={!courseTopic.trim() || chapters.every((c) => !c.title.trim())}
                className="w-full border-2 border-black bg-black text-white p-3 font-bold hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                正式生成課程
              </button>
            </div>
          </aside>
        )}

        {/* ================= 我的筆記 ================= */}
        {currentView === 'whiteboards' && (
          selectedWhiteboardId ? (
            <NoteWorkspace whiteboardId={selectedWhiteboardId} />
          ) : (
            <WhiteboardDashboard
              onOpen={(id) => setSelectedWhiteboardId(id)}
            />
          )
        )}

        {/* ================= 階段三：課程與助教 ================= */}
        {currentView === 'courses' && phase === 'course' && courseData && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-3 gap-6">
            <section className={`${showAssistant ? 'lg:col-span-2' : 'lg:col-span-3'} border-2 border-black p-6 max-h-[calc(100vh-140px)] overflow-y-auto`}>
              <h2 className="text-2xl font-bold mb-4">{courseData.course_title}</h2>
              <article className="max-w-none leading-relaxed space-y-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:border-b-2 [&_h1]:border-black [&_h1]:pb-2 [&_h1]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:border-b [&_h2]:border-black [&_h2]:pb-1 [&_h2]:mt-5 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:my-1 [&_strong]:font-bold [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm [&_pre]:bg-gray-100 [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-black">
                <ReactMarkdown
                  components={MARKDOWN_COMPONENTS}
                >
                  {markdownContent}
                </ReactMarkdown>
              </article>
              <div className="mt-6 pt-4 border-t-2 border-black flex flex-wrap gap-3">
                <a
                  href={`data:text/markdown;charset=utf-8,${encodeURIComponent(markdownContent)}`}
                  download={`${courseData.course_title || 'course'}.md`}
                  className="inline-block border-2 border-black bg-white px-4 py-2 font-bold hover:bg-black hover:text-white transition"
                >
                  下載 Markdown 講義
                </a>
                <button
                  onClick={handleGenerateTextNote}
                  className="inline-block border-2 border-black bg-black text-white px-4 py-2 font-bold hover:bg-gray-800 transition"
                >
                  ✨ 一鍵生成 AI 重點筆記
                </button>
              </div>
            </section>

            {showAssistant && (
              <aside className="border-2 border-black flex flex-col max-h-[calc(100vh-140px)]">
                <div className="border-b-2 border-black p-3 font-bold bg-black text-white uppercase tracking-wider text-sm">
                  隨堂 AI 助教
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {taMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[90%] border border-black p-2 text-sm whitespace-pre-wrap leading-relaxed ${msg.role === 'user' ? 'bg-black text-white' : 'bg-white text-black'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={taChatEndRef} />
                </div>
                {userPlan?.is_premium ? (
                  <div className="border-t-2 border-black p-3 flex gap-2">
                    <input
                      type="text"
                      className="flex-1 border-2 border-black p-2 text-sm outline-none focus:bg-gray-50"
                      placeholder="向助教提問..."
                      value={taInput}
                      onChange={(e) => setTaInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleTaMessage()}
                    />
                    <button
                      onClick={handleTaMessage}
                      className="border-2 border-black bg-white px-4 text-sm font-bold hover:bg-black hover:text-white transition"
                    >
                      問
                    </button>
                  </div>
                ) : (
                  <div className="border-t-2 border-black p-4 bg-yellow-50 text-center space-y-2">
                    <div className="text-sm font-bold">👑 隨堂 AI 助教為專業版專屬功能</div>
                    <div className="text-xs text-gray-600">
                      升級後可針對講義任意提問，由 AI 助教依內容回覆。
                    </div>
                    <button
                      onClick={() => setIsPaywallOpen(true)}
                      className="w-full border-2 border-black bg-black text-white p-2 text-sm font-bold hover:bg-gray-800 transition"
                    >
                      解鎖所有功能
                    </button>
                  </div>
                )}
              </aside>
            )}
          </div>
        )}

      </main>

      <PaywallModal
        open={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        onUpgrade={() => { setIsPaywallOpen(false); handleUpgrade(); }}
        courseCount={userPlan?.course_count}
        freeLimit={userPlan?.free_limit}
      />
    </div>
  );
}