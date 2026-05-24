'use client';

import { useEffect, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { filterSuggestionItems, type PartialBlock } from '@blocknote/core';
import { useCreateBlockNote, SuggestionMenuController, getDefaultReactSlashMenuItems } from '@blocknote/react';

const ALLOWED_SLASH_KEYS = new Set([
  'heading_1', 'heading_2', 'heading_3',
  'bullet_list', 'numbered_list', 'paragraph',
]);
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

export interface Note {
  id: string;
  content: string;
  image_url: string | null;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  is_transparent: boolean;
  created_at: string;
}

interface Props {
  note: Note;
  onPatch: (id: string, patch: Partial<Pick<Note, 'content' | 'pos_x' | 'pos_y' | 'width' | 'height'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onStartLink?: (id: string) => void;
  isLinkSource?: boolean;
  onCardClick?: (id: string) => void;
  onMove?: () => void; // 用來通知 xarrow 重繪
  autoFocus?: boolean; // 新建立時自動聚焦編輯器
}

function parseInitialBlocks(content: string): PartialBlock[] | undefined {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as PartialBlock[];
  } catch {}
  // 舊資料：純文字 → 單一段落
  return [{ type: 'paragraph', content }];
}

export default function NoteCard({
  note,
  onPatch,
  onDelete,
  onStartLink,
  isLinkSource,
  onCardClick,
  onMove,
  autoFocus,
}: Props) {
  const [isHovered, setIsHovered] = useState(false);
  // 父層以 key={note.id} 掛載 → 每張卡片獨立實例；lazy init 只跑一次，用原始 note.content 建立 blocks。
  // 之後打字時 editor 的內部 state 才是 source of truth，不需要再跟 note.content 同步。
  const [initialBlocks] = useState<PartialBlock[] | undefined>(() => parseInitialBlocks(note.content));
  const editor = useCreateBlockNote({ initialContent: initialBlocks });

  // 防抖保存
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // 新建立的卡片自動聚焦編輯器（讓雙擊畫布後可以立刻打字）
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(() => {
      try { editor.focus(); } catch {}
    }, 80);
    return () => clearTimeout(t);
  }, [autoFocus, editor]);

  const handleEditorChange = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const blocks = editor.document;
        onPatch(note.id, { content: JSON.stringify(blocks) });
      } catch (e) {
        console.error('序列化 BlockNote 內容失敗', e);
      }
    }, 600);
  };

  return (
    <Rnd
      size={{ width: note.width, height: note.height }}
      position={{ x: note.pos_x, y: note.pos_y }}
      minWidth={note.is_transparent ? 100 : 180}
      minHeight={note.is_transparent ? 30 : 160}
      bounds="parent"
      dragHandleClassName="note-drag-handle"
      onDrag={() => onMove?.()}
      onResize={() => onMove?.()}
      onDragStop={(_e, d) => { onPatch(note.id, { pos_x: d.x, pos_y: d.y }); onMove?.(); }}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onPatch(note.id, {
          width: parseFloat(ref.style.width),
          height: parseFloat(ref.style.height),
          pos_x: position.x,
          pos_y: position.y,
        });
        onMove?.();
      }}
      className={`${
        note.is_transparent
          ? 'bg-transparent border-none shadow-none p-0 hover:outline hover:outline-1 hover:outline-gray-300'
          : 'bg-yellow-50 border-2 shadow-[4px_4px_0_0_rgba(0,0,0,1)] border-black'
      } ${isLinkSource ? 'ring-2 ring-blue-400' : ''}`}
    >
      <div
        id={`note-${note.id}`}
        className={`relative w-full h-full flex flex-col ${note.is_transparent ? 'note-transparent overflow-visible' : 'overflow-hidden'}`}
        onClick={() => onCardClick?.(note.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 拖曳把手（標題列）：一般卡片常駐；透明卡片僅 hover 時浮在上方不佔空間 */}
        {!note.is_transparent && (
          <div
            className="note-drag-handle flex items-center gap-1 px-2 py-1 bg-black text-white text-xs cursor-grab active:cursor-grabbing select-none shrink-0"
            title="拖曳我移動卡片"
          >
            <span className="opacity-60">⠿⠿</span>
            <div className="flex-1" />
            <button
              onClick={(e) => { e.stopPropagation(); onStartLink?.(note.id); }}
              className="w-5 h-5 flex items-center justify-center border border-white hover:bg-blue-500 font-bold text-[10px]"
              aria-label="開始連線"
              title="從這張卡片連到另一張"
            >
              🔗
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('確定刪除這張卡片？')) onDelete(note.id);
              }}
              className="w-5 h-5 flex items-center justify-center border border-white hover:bg-red-500 font-bold text-[10px]"
              aria-label="刪除"
            >
              ✕
            </button>
          </div>
        )}

        {/* 透明卡片的浮動工具列：絕對定位在右上角，僅 hover 顯示 */}
        {note.is_transparent && isHovered && (
          <div className="absolute -top-6 right-0 z-20 flex gap-1">
            <div
              className="note-drag-handle flex items-center justify-center w-6 h-6 bg-black/80 text-white cursor-grab active:cursor-grabbing select-none text-[10px]"
              title="拖曳移動"
            >
              ⠿
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onStartLink?.(note.id); }}
              className="w-6 h-6 flex items-center justify-center bg-white border border-black hover:bg-blue-500 hover:text-white font-bold text-[10px]"
              title="連線"
            >
              🔗
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('確定刪除？')) onDelete(note.id);
              }}
              className="w-6 h-6 flex items-center justify-center bg-white border border-black hover:bg-red-500 hover:text-white font-bold text-[10px]"
              title="刪除"
            >
              ✕
            </button>
          </div>
        )}

        {note.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={note.image_url}
            alt=""
            className={`w-full object-cover shrink-0 pointer-events-none ${note.is_transparent ? '' : 'border-b-2 border-black'}`}
            style={{ height: '35%' }}
            draggable={false}
          />
        )}

        <div className={`flex-1 overflow-y-auto text-sm ${note.is_transparent ? 'bg-transparent' : 'bg-white'}`}>
          <BlockNoteView
            editor={editor}
            theme="light"
            slashMenu={false}
            onChange={handleEditorChange}
          >
            <SuggestionMenuController
              triggerCharacter="/"
              getItems={async (query) => {
                // 只保留 Heading / BulletList / NumberedList / Paragraph；
                // 移除 Table / Image / Video / Audio / File / Code block / Quote。
                const defaults = getDefaultReactSlashMenuItems(editor);
                const filtered = defaults.filter((it) => {
                  const key = String((it as { key?: unknown }).key ?? '').toLowerCase();
                  return ALLOWED_SLASH_KEYS.has(key);
                });
                return filterSuggestionItems(filtered, query);
              }}
            />
          </BlockNoteView>
        </div>
      </div>
    </Rnd>
  );
}
