'use client';

interface Props {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  courseCount?: number;
  freeLimit?: number;
}

export default function PaywallModal({ open, onClose, onUpgrade, courseCount, freeLimit }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white border-2 border-black w-full max-w-lg shadow-[8px_8px_0_0_rgba(0,0,0,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b-2 border-black p-4 flex items-center justify-between bg-black text-white">
          <div className="font-bold tracking-wider">⭐ 解鎖無限學習潛能</div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center border border-white hover:bg-white hover:text-black font-bold"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold">升級 Pro，解除所有限制</h2>
            {typeof courseCount === 'number' && typeof freeLimit === 'number' && (
              <p className="text-sm text-gray-600">
                你目前使用量：<span className="font-mono font-bold">{courseCount}/{freeLimit}</span> 堂課程
              </p>
            )}
          </div>

          <ul className="space-y-2 text-sm">
            {[
              '無限制生成 AI 課程（免費版每月僅限 5 堂）',
              '保留所有歷史紀錄，隨時回來閱讀',
              '「一鍵生成 AI 重點筆記」解鎖',
              '完整 Mermaid 圖表、情境配圖、Tavily 聯網資料',
              'AI 助教 RAG 問答無使用限制',
            ].map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="font-bold text-green-600 shrink-0">✓</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="pt-2 border-t-2 border-black space-y-2">
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-4xl font-bold">NT$ 300</span>
              <span className="text-sm text-gray-500">/ 月</span>
            </div>
            <button
              onClick={onUpgrade}
              className="w-full border-2 border-black bg-yellow-300 text-black p-3 font-bold text-lg hover:bg-yellow-400 transition shadow-[4px_4px_0_0_rgba(0,0,0,1)] hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              ⭐ 立即升級專業版
            </button>
            <p className="text-xs text-gray-500 text-center">
              將跳轉至藍新金流支付頁面，支援信用卡付款
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
