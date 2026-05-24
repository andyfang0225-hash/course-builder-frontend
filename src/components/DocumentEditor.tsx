'use client';

import { useEffect, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import type { PartialBlock } from '@blocknote/core';
import { API_BASE_URL, getAuthHeaders } from '@/lib/api';

interface Props {
  whiteboardId: string;
}

// 解析 document_content：可能是已經結構化的 BlockNote JSON，
// 或是「原始 Markdown」（例如 /to-note 端點直接灌進來的講義）。
// 後者要在 mount 後用 editor.tryParseMarkdownToBlocks 轉成 blocks。
type ParsedContent =
  | { kind: 'blocks'; blocks: PartialBlock[] }
  | { kind: 'markdown'; markdown: string }
  | { kind: 'empty' };

function parseContent(raw: string): ParsedContent {
  if (!raw) return { kind: 'empty' };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return { kind: 'blocks', blocks: parsed as PartialBlock[] };
    }
  } catch {}
  return { kind: 'markdown', markdown: raw };
}

export default function DocumentEditor({ whiteboardId }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [parsed, setParsed] = useState<ParsedContent>({ kind: 'empty' });

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
        setParsed(parseContent(data.whiteboard?.document_content ?? ''));
      } catch (err) {
        console.error('讀取文件失敗', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [whiteboardId]);

  if (!loaded) {
    return <div className="p-8 text-center text-gray-500">載入中...</div>;
  }

  return (
    <DocumentEditorInner
      key={whiteboardId}
      whiteboardId={whiteboardId}
      parsed={parsed}
    />
  );
}

function DocumentEditorInner({
  whiteboardId,
  parsed,
}: {
  whiteboardId: string;
  parsed: ParsedContent;
}) {
  // markdown 模式：先給空 doc，等 editor 建好後再 async 轉成 blocks。
  const initialContent: PartialBlock[] | undefined =
    parsed.kind === 'blocks' ? parsed.blocks : undefined;
  const editor = useCreateBlockNote({ initialContent });

  // markdown → blocks 一次性轉換（只在第一次開啟時跑）
  // replaceBlocks 會觸發 BlockNoteView 的 onChange，由 handleContentChange 把 JSON 寫回去；
  // 之後再開這份筆記會直接走 'blocks' 分支，不會再轉一次。
  useEffect(() => {
    if (parsed.kind !== 'markdown') return;
    let cancelled = false;
    (async () => {
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(parsed.markdown);
        if (cancelled || !blocks?.length) return;
        editor.replaceBlocks(editor.document, blocks);
      } catch (err) {
        console.error('Markdown 轉 blocks 失敗，保留原始文字當 fallback', err);
        // 失敗時降級成單一段落，至少別讓使用者看到空畫面
        editor.replaceBlocks(editor.document, [
          { type: 'paragraph', content: parsed.markdown },
        ]);
      }
    })();
    return () => { cancelled = true; };
  }, [editor, parsed]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const contentSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current);
  }, []);

  const handleContentChange = () => {
    if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current);
    setSaveStatus('saving');
    contentSaveTimer.current = setTimeout(async () => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) { setSaveStatus('idle'); return; }
        const content = JSON.stringify(editor.document);
        const res = await fetch(`${API_BASE_URL}/api/whiteboards/${whiteboardId}/document`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveStatus('saved');
      } catch (err) {
        console.error('儲存文件失敗', err);
        setSaveStatus('idle');
      }
    }, 700);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-end text-xs text-gray-500 font-mono mb-1 h-4">
        {saveStatus === 'saving' ? '儲存中...' : saveStatus === 'saved' ? '已儲存' : ''}
      </div>
      <div className="bg-white min-h-[calc(100vh-220px)]">
        <BlockNoteView
          editor={editor}
          theme="light"
          onChange={handleContentChange}
        />
      </div>
    </div>
  );
}
