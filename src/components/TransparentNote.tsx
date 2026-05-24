'use client';

import { useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import type { Note } from './NoteCard';

interface Props {
  note: Note;
  onPatch: (id: string, patch: Partial<Pick<Note, 'content' | 'pos_x' | 'pos_y'>>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove?: () => void;
}

export default function TransparentNote({ note, onPatch, onDelete, onMove }: Props) {
  // draft === null 表示未在編輯；否則為編輯中的文字值
  const [draft, setDraft] = useState<string | null>(null);
  const isEditing = draft !== null;

  const [isHovered, setIsHovered] = useState(false);

  // 拖曳中累積的 offset；drag 結束 → onPatch → 父層 optimistic 更新 note.pos_x/y → offset 重置為 0
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const displayX = note.pos_x + dragOffset.x;
  const displayY = note.pos_y + dragOffset.y;

  const finishEdit = async () => {
    if (draft === null) return;
    const committed = draft;
    setDraft(null);
    if (committed !== note.content) {
      await onPatch(note.id, { content: committed });
    }
  };

  const startEdit = () => setDraft(note.content);

  // 自訂拖曳（按下 → 若有移動才算拖曳；無移動即 click → 進編輯模式）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, textarea, input')) return;
    e.preventDefault();

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const basePosX = note.pos_x;
    const basePosY = note.pos_y;
    let dragged = false;

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!dragged && Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
      if (dragged) {
        // 夾住讓終點不會跑到負座標
        const clampedDx = Math.max(-basePosX, dx);
        const clampedDy = Math.max(-basePosY, dy);
        setDragOffset({ x: clampedDx, y: clampedDy });
        onMove?.();
      }
    };

    const handleUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      if (dragged) {
        const dx = Math.max(-basePosX, ev.clientX - startClientX);
        const dy = Math.max(-basePosY, ev.clientY - startClientY);
        // 先送 patch（父層會 optimistic 更新 note.pos_x/y），再把 offset 歸零
        onPatch(note.id, { pos_x: basePosX + dx, pos_y: basePosY + dy });
        setDragOffset({ x: 0, y: 0 });
        onMove?.();
      } else {
        // click → 進入編輯
        startEdit();
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div
      id={`note-${note.id}`}
      style={{ position: 'absolute', left: displayX, top: displayY }}
      className="inline-block select-none"
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isEditing ? (
        <TextareaAutosize
          autoFocus
          value={draft ?? ''}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={finishEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(null);
            }
          }}
          minRows={1}
          className="bg-transparent border-none outline-none resize-none text-sm leading-relaxed text-black px-1 min-w-[120px]"
          style={{ fontFamily: 'inherit' }}
        />
      ) : (
        <div
          className="whitespace-pre-wrap text-sm leading-relaxed px-1 min-w-[20px] min-h-[1.25rem] hover:outline hover:outline-1 hover:outline-gray-300 cursor-move"
        >
          {note.content || <span className="text-gray-300 italic">（空白）</span>}
        </div>
      )}

      {isHovered && !isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm('確定刪除？')) onDelete(note.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute -top-5 -right-1 w-5 h-5 bg-white border border-black hover:bg-red-500 hover:text-white text-[10px] font-bold flex items-center justify-center"
          title="刪除"
        >
          ✕
        </button>
      )}
    </div>
  );
}
