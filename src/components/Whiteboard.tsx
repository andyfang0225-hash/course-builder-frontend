'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Xarrow, { Xwrapper, useXarrow } from 'react-xarrows';
import TextareaAutosize from 'react-textarea-autosize';
import NoteCard, { Note } from './NoteCard';
import TransparentNote from './TransparentNote';
import { API_BASE_URL, getAuthHeaders } from '@/lib/api';

interface Connection {
  id: string;
  source_note_id: string;
  target_note_id: string;
  created_at: string;
}

interface Props {
  whiteboardId: string | null;
}

const DEFAULT_WIDTH = 240;
const DEFAULT_HEIGHT = 180;

function WhiteboardInner({ whiteboardId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [newContent, setNewContent] = useState('');
  const [newFile, setNewFile] = useState<File | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [linkingFromId, setLinkingFromId] = useState<string | null>(null);
  const [focusNoteId, setFocusNoteId] = useState<string | null>(null);

  // Figma 風格：畫布上浮動的未存檔草稿
  const [draftNote, setDraftNote] = useState<{ x: number; y: number } | null>(null);
  const [draftContent, setDraftContent] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateXarrow = useXarrow();

  const normalize = (n: Partial<Note>): Note => ({
    id: n.id ?? '',
    content: n.content ?? '',
    image_url: n.image_url ?? null,
    pos_x: n.pos_x ?? 0,
    pos_y: n.pos_y ?? 0,
    width: n.width ?? DEFAULT_WIDTH,
    height: n.height ?? DEFAULT_HEIGHT,
    is_transparent: n.is_transparent ?? false,
    created_at: n.created_at ?? '',
  });

  const fetchBundle = useCallback(async () => {
    if (!whiteboardId) return;
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE_URL}/api/whiteboards/${whiteboardId}/bundle`, {
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setNotes((data.notes || []).map(normalize));
      setConnections(data.connections || []);
    } catch (err) {
      console.error('讀取白板資料失敗', err);
    }
  }, [whiteboardId]);

  useEffect(() => { fetchBundle(); }, [fetchBundle]);

  const createNoteOnServer = async (fields: Record<string, string | number | boolean>, file?: File | null) => {
    if (!whiteboardId) return null;
    const headers = await getAuthHeaders();
    if (!headers) return null;
    const form = new FormData();
    form.append('whiteboard_id', whiteboardId);
    Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));
    if (file) form.append('file', file);
    const res = await fetch(`${API_BASE_URL}/api/notes`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const normalized = normalize(await res.json());
    // Safety net：若 server response 缺 is_transparent（Supabase 預設可能不回所有欄位），
    // 以前端送出的值覆寫，避免被 normalize 的 `?? false` 默默變回 false。
    if (typeof fields.is_transparent === 'boolean') {
      normalized.is_transparent = fields.is_transparent;
    }
    return normalized;
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // 只在畫布空白處觸發
    if (linkingFromId) { setLinkingFromId(null); return; }
    if (draftNote) return; // 讓既有 draft 的 onBlur 先處理
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    setDraftContent('');
    setDraftNote({ x, y });
  };

  const commitDraft = async () => {
    if (!draftNote) return;
    const content = draftContent.trim();
    const pos = draftNote;
    setDraftNote(null);
    setDraftContent('');
    if (!content) return; // 空白就直接取消
    try {
      const created = await createNoteOnServer({
        content,
        pos_x: pos.x,
        pos_y: pos.y,
        width: 300,
        height: 40,
        is_transparent: true,
      });
      if (created) {
        setNotes((prev) => [...prev, created]);
        setFocusNoteId(created.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const addNote = async () => {
    if (!whiteboardId || (!newContent.trim() && !newFile)) return;
    setIsAdding(true);
    try {
      const created = await createNoteOnServer({
        content: newContent,
        pos_x: 60 + (notes.length % 5) * 40,
        pos_y: 60 + Math.floor(notes.length / 5) * 40,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        is_transparent: false,
      }, newFile);
      if (created) {
        setNotes((prev) => [...prev, created]);
        setFocusNoteId(created.id);
      }
      setNewContent('');
      setNewFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      alert('新增筆記失敗');
    } finally {
      setIsAdding(false);
    }
  };

  const patchNote: React.ComponentProps<typeof NoteCard>['onPatch'] = async (id, patch) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('更新筆記失敗', err);
    }
  };

  const deleteNote: React.ComponentProps<typeof NoteCard>['onDelete'] = async (id) => {
    const snapshot = notes;
    const snapshotConns = connections;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    // 本地也移除相關連線（DB 有 CASCADE）
    setConnections((prev) => prev.filter((c) => c.source_note_id !== id && c.target_note_id !== id));
    try {
      const headers = await getAuthHeaders();
      if (!headers) { setNotes(snapshot); setConnections(snapshotConns); return; }
      const res = await fetch(`${API_BASE_URL}/api/notes/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(err);
      setNotes(snapshot);
      setConnections(snapshotConns);
      alert('刪除失敗');
    }
  };

  const handleStartLink = (id: string) => {
    setLinkingFromId(id);
  };

  const handleCardClick = async (id: string) => {
    if (!linkingFromId || linkingFromId === id || !whiteboardId) return;
    const source = linkingFromId;
    setLinkingFromId(null);
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE_URL}/api/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          whiteboard_id: whiteboardId,
          source_note_id: source,
          target_note_id: id,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `HTTP ${res.status}`);
      }
      const created: Connection = await res.json();
      setConnections((prev) => [...prev, created]);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert(`建立連線失敗：${msg}`);
    }
  };

  const deleteConnection = async (id: string) => {
    const snapshot = connections;
    setConnections((prev) => prev.filter((c) => c.id !== id));
    try {
      const headers = await getAuthHeaders();
      if (!headers) { setConnections(snapshot); return; }
      const res = await fetch(`${API_BASE_URL}/api/connections/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(err);
      setConnections(snapshot);
    }
  };

  if (!whiteboardId) {
    return (
      <div className="border-2 border-black p-8 text-center text-gray-500">
        請先選擇一個白板。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 新增卡片 */}
      <div className="border-2 border-black p-4 space-y-2 bg-white">
        <div className="font-bold text-sm">新增筆記卡片</div>
        <textarea
          className="w-full border-2 border-black p-2 outline-none focus:bg-gray-50 resize-none"
          rows={2}
          placeholder="輸入初始文字（卡片建立後可用 / 叫出更多格式）..."
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="border-2 border-black bg-white px-3 py-1 text-sm font-bold hover:bg-black hover:text-white transition cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
            />
            📎 選圖
          </label>
          {newFile && (
            <span className="text-sm font-mono truncate max-w-[200px]">{newFile.name}</span>
          )}
          <button
            onClick={addNote}
            disabled={isAdding || (!newContent.trim() && !newFile)}
            className="ml-auto border-2 border-black bg-black text-white px-4 py-1 text-sm font-bold hover:bg-gray-800 transition disabled:opacity-50"
          >
            {isAdding ? '新增中...' : '新增卡片'}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          💡 拖曳 / 縮放 / ✕ 刪除 / 🔗 連線（點 🔗 後再點另一張卡片建立連線）/ 卡片內用 <code>/</code> 叫出格式選單
        </p>
        {linkingFromId && (
          <div className="flex items-center justify-between gap-2 text-sm border-2 border-blue-500 bg-blue-50 px-3 py-1">
            <span>🔗 正在從一張卡片建立連線，請點擊目標卡片...</span>
            <button
              onClick={() => setLinkingFromId(null)}
              className="font-bold underline"
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* Viewport：可上下左右滾動 */}
      <div className="w-full h-screen overflow-auto border-2 border-black">
        {/* 內層畫布：5000x5000 的大世界 */}
        <div
          onDoubleClick={handleCanvasDoubleClick}
          className="relative bg-[radial-gradient(circle,#ddd_1px,transparent_1px)] [background-size:24px_24px]"
          style={{ minWidth: 5000, minHeight: 5000 }}
        >
          {notes.length === 0 && (
            <div className="absolute top-12 left-12 text-gray-400 pointer-events-none">
              💡 雙擊畫布任意空白處即可直接打字；或從上方新增卡片。
            </div>
          )}

          {/* 連線箭頭 */}
          {connections.map((c) => (
            <Xarrow
              key={c.id}
              start={`note-${c.source_note_id}`}
              end={`note-${c.target_note_id}`}
              color="#111"
              strokeWidth={2}
              headSize={6}
              path="smooth"
              labels={{
                middle: (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConnection(c.id); }}
                    className="w-5 h-5 bg-white border border-black text-[10px] font-bold hover:bg-red-500 hover:text-white"
                    title="刪除連線"
                  >
                    ✕
                  </button>
                ),
              }}
            />
          ))}

          {notes.map((note) => (
            note.is_transparent ? (
              <TransparentNote
                key={note.id}
                note={note}
                onPatch={patchNote}
                onDelete={deleteNote}
                onMove={updateXarrow}
              />
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                onPatch={patchNote}
                onDelete={deleteNote}
                onStartLink={handleStartLink}
                isLinkSource={linkingFromId === note.id}
                onCardClick={handleCardClick}
                onMove={updateXarrow}
                autoFocus={focusNoteId === note.id}
              />
            )
          ))}

          {/* 畫布上浮動的未存檔草稿 */}
          {draftNote && (
            <div
              style={{ position: 'absolute', left: draftNote.x, top: draftNote.y }}
              className="z-30"
            >
              <TextareaAutosize
                autoFocus
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setDraftContent(''); setDraftNote(null); }
                }}
                minRows={1}
                placeholder=""
                className="bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-black px-1 min-w-[120px]"
                style={{ fontFamily: 'inherit' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Whiteboard(props: Props) {
  return (
    <Xwrapper>
      <WhiteboardInner {...props} />
    </Xwrapper>
  );
}
