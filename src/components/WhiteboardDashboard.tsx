'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL, getAuthHeaders } from '@/lib/api';

interface WhiteboardItem {
  id: string;
  title: string;
  created_at: string;
}

interface Props {
  onOpen: (id: string) => void;
}

export default function WhiteboardDashboard({ onOpen }: Props) {
  const [items, setItems] = useState<WhiteboardItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // 建立 Modal 狀態
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const fetchList = async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) return;
      const res = await fetch(`${API_BASE_URL}/api/whiteboards`, {
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: WhiteboardItem[] = await res.json();
      setItems(data);
    } catch (err) {
      console.error('讀取白板列表失敗', err);
    }
  };

  useEffect(() => { fetchList(); }, []);

  const openCreateModal = () => {
    setNewTitle('');
    setIsCreateModalOpen(true);
  };

  const confirmCreate = async () => {
    setIsCreating(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) { alert('請先登入'); return; }
      const payload: { title?: string; mode: string } = { mode: 'document' };
      if (newTitle.trim()) payload.title = newTitle.trim();
      const res = await fetch(`${API_BASE_URL}/api/whiteboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created: WhiteboardItem = await res.json();
      setItems((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('新增失敗');
    } finally {
      setIsCreating(false);
    }
  };

  const beginEdit = (item: WhiteboardItem) => {
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const commitEdit = async () => {
    if (!editingId) return;
    const id = editingId;
    const nextTitle = editingTitle.trim();
    setEditingId(null);
    const original = items.find((i) => i.id === id)?.title;
    if (!nextTitle || nextTitle === original) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, title: nextTitle } : i)));
    try {
      const headers = await getAuthHeaders();
      if (!headers) { fetchList(); return; }
      const res = await fetch(`${API_BASE_URL}/api/whiteboards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error('更新標題失敗', err);
      fetchList();
    }
  };

  const deleteBoard = async (id: string, title: string) => {
    if (!confirm(`確定刪除「${title}」？這會一併刪除它所有的卡片。`)) return;
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const headers = await getAuthHeaders();
      if (!headers) { setItems(snapshot); return; }
      const res = await fetch(`${API_BASE_URL}/api/whiteboards/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error(err);
      setItems(snapshot);
      alert('刪除失敗');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center border-b-2 border-black pb-2">
        <h2 className="text-2xl font-bold">我的筆記</h2>
        <button
          onClick={openCreateModal}
          className="border-2 border-black bg-black text-white px-4 py-1 font-bold hover:bg-gray-800 transition"
        >
          + 新增筆記
        </button>
      </div>

      {items.length === 0 ? (
        <div className="border-2 border-black p-8 text-center text-gray-500">
          尚無筆記。點右上角「+ 新增筆記」開始。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="group relative border-2 border-black bg-white p-4 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-shadow cursor-pointer"
              onClick={() => onOpen(item.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteBoard(item.id, item.title);
                }}
                className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center border-2 border-black bg-white opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white font-bold text-xs transition"
                aria-label="刪除"
              >
                ✕
              </button>

              {editingId === item.id ? (
                <input
                  autoFocus
                  value={editingTitle}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={commitEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-full border-b-2 border-black bg-transparent outline-none font-bold text-lg pr-8"
                />
              ) : (
                <h3
                  className="font-bold text-lg pr-8 truncate"
                  title="點擊文字編輯標題"
                  onClick={(e) => {
                    e.stopPropagation();
                    beginEdit(item);
                  }}
                >
                  {item.title}
                </h3>
              )}

              <div className="text-xs text-gray-500 font-mono mt-2">
                {new Date(item.created_at).toLocaleString('zh-TW', {
                  year: 'numeric', month: '2-digit', day: '2-digit',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 新增筆記 Modal */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
          onClick={() => !isCreating && setIsCreateModalOpen(false)}
        >
          <div
            className="bg-white border-2 border-black w-full max-w-md shadow-[8px_8px_0_0_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b-2 border-black p-4 bg-black text-white font-bold">
              新增筆記
            </div>
            <div className="p-5 space-y-5">
              <div className="space-y-2">
                <label className="font-bold text-sm block">標題</label>
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例如：專案架構、會議紀錄..."
                  className="w-full border-2 border-black p-2 outline-none focus:bg-gray-50"
                />
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                建立後可在筆記內自由切換「📝 文字」與「🎨 白板」兩種模式，兩邊內容獨立儲存。
              </p>
            </div>
            <div className="border-t-2 border-black p-3 flex justify-end gap-2">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isCreating}
                className="border-2 border-black bg-white px-4 py-1 font-bold hover:bg-gray-100 transition"
              >
                取消
              </button>
              <button
                onClick={confirmCreate}
                disabled={isCreating}
                className="border-2 border-black bg-black text-white px-4 py-1 font-bold hover:bg-gray-800 transition disabled:opacity-50"
              >
                {isCreating ? '建立中...' : '建立'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
