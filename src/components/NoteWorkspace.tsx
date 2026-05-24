'use client';

import { useEffect, useState } from 'react';
import Whiteboard from './Whiteboard';
import DocumentEditor from './DocumentEditor';
import { API_BASE_URL, getAuthHeaders } from '@/lib/api';

type ViewMode = 'document' | 'board';

interface Props {
  whiteboardId: string;
}

export default function NoteWorkspace({ whiteboardId }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('document');
  const [title, setTitle] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) { if (!cancelled) setLoaded(true); return; }
        const res = await fetch(`${API_BASE_URL}/api/whiteboards/${whiteboardId}/bundle`, {
          headers,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setTitle(data.whiteboard?.title ?? '');
        const storedMode = data.whiteboard?.mode;
        if (storedMode === 'board' || storedMode === 'document') {
          setViewMode(storedMode);
        } else {
          setViewMode('document');
        }
      } catch (err) {
        console.error('讀取筆記失敗', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [whiteboardId]);

  const persistMode = async (mode: ViewMode) => {
    // 非關鍵請求（記住上次看的 tab），失敗不影響操作
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      await fetch(`${API_BASE_URL}/api/whiteboards/${whiteboardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ mode }),
      });
    } catch (err) {
      console.error('儲存 mode 偏好失敗', err);
    }
  };

  const switchMode = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setViewMode(mode);
    persistMode(mode);
  };

  if (!loaded) {
    return <div className="p-8 text-center text-gray-500">載入筆記中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 頂部：標題 + Tabs */}
      <div className="border-b-2 border-black pb-2 flex items-center gap-4 flex-wrap">
        <h2 className="text-xl font-bold truncate flex-1 min-w-[120px]">{title || '（無標題）'}</h2>
        <div className="flex items-center border-2 border-black">
          <button
            onClick={() => switchMode('document')}
            className={`px-3 py-1 text-sm font-bold transition ${
              viewMode === 'document' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
            }`}
          >
            📝 文字
          </button>
          <button
            onClick={() => switchMode('board')}
            className={`px-3 py-1 text-sm font-bold transition border-l-2 border-black ${
              viewMode === 'board' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
            }`}
          >
            🎨 白板
          </button>
        </div>
      </div>

      {/* 條件渲染：內容獨立儲存在 whiteboards.document_content vs notes/connections */}
      {viewMode === 'document' ? (
        <DocumentEditor whiteboardId={whiteboardId} />
      ) : (
        <Whiteboard whiteboardId={whiteboardId} />
      )}
    </div>
  );
}
