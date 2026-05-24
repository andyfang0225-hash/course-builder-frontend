import Link from 'next/link';

export const metadata = {
  title: '服務條款｜專屬課程建構室',
  description: '專屬課程建構室服務條款 (Terms of Service)',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <header className="border-b-2 border-black p-4 sticky top-0 bg-white z-50 flex items-center justify-between">
        <h1 className="font-bold text-xl tracking-wider">服務條款</h1>
        <Link
          href="/"
          className="text-sm font-bold border-2 border-black px-4 py-1 hover:bg-black hover:text-white transition"
        >
          ← 返回首頁
        </Link>
      </header>

      <article className="max-w-3xl mx-auto p-6 md:p-10 leading-relaxed space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-bold border-b-2 border-black pb-2">服務條款 (Terms of Service)</h2>
          <p>
            歡迎您使用 <strong>專屬課程建構室</strong>（以下簡稱「本平台」）。本服務條款是您與本平台營運者（即個人開發者，以下簡稱「營運者」或「我們」）之間的法律協議。當您註冊、存取或使用本平台服務時，即表示您已閱讀、瞭解並同意接受本條款之所有內容。
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">1. 服務性質與 AI 生成內容免責聲明</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>AI 生成技術：</strong>
              本平台的核心服務為透過人工智慧模型（Google Gemini）為您量身打造專屬課程。您理解並同意，課程大綱、文字、測驗等內容均由 AI 自動生成。
            </li>
            <li>
              <strong>準確性與專業性：</strong>
              雖然我們致力於提供優質的生成結果，但 AI 技術仍有其限制。我們無法保證生成內容的絕對準確性、完整性、時效性或適用性（特別是涉及醫療、法律、財務等專業領域）。課程內容僅供參考與學習輔助，您應自行判斷並承擔使用該內容的風險。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">2. 帳號註冊與登入</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Google 登入：</strong>
              本平台提供 Google 帳號授權登入服務。您必須確保您使用的 Google 帳號歸您本人所有，並對透過該帳號在平台上進行的所有活動負責。
            </li>
            <li>
              <strong>帳號限制：</strong>
              本平台帳號僅供註冊者個人使用，嚴禁轉讓或與他人共用。若發現上述行為，營運者有權暫停或終止您的帳號。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">3. 付費與退款政策（問卷退費機制）</h3>
          <p>
            <strong>費用支付：</strong>
            您同意按照本平台標示之價格與付款方式支付課程生成或訂閱費用。
          </p>
          <p>
            <strong>退款條件與流程：</strong>
            我們理解 AI 生成的結果可能偶爾不符合您的預期。若您對課程不滿意並希望申請退費，請遵循以下流程：
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>您必須在購買後的 <strong>7 天</strong> 內提出申請。</li>
            <li>您必須完整填寫並提交「退款申請問卷」，告訴我們您不滿意的原因以及 AI 生成內容的具體問題。</li>
            <li>待我們收到並確認問卷內容無誤後，將於 <strong>14 個工作天</strong> 內為您辦理退費手續。</li>
          </ul>
          <p className="border-2 border-black bg-yellow-50 p-3">
            ⚠️ 請注意：若未填寫退款申請問卷，或申請時間超過規定期限，本平台將無法為您辦理退款。
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">4. 智慧財產權與使用規範</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              透過您提供的指令（Prompt）所生成的專屬課程內容，您可基於個人學習目的自由使用。但未經同意，請勿將平台整體介面、系統架構或商標進行複製或商業利用。
            </li>
            <li>
              您同意不在生成課程的指令中輸入違法、暴力、色情、侵權或包含他人敏感個人隱私的資訊。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">5. 服務變更、中斷與終止</h3>
          <p>
            本平台由個人開發與營運，我們保留隨時修改、暫停或終止部分或全部服務的權利。若遇系統維護或第三方服務（如 Google API、Supabase 等）異常導致服務中斷，我們將盡力協助排除，但不負擔相關賠償責任。
          </p>
        </section>
      </article>

      <footer className="max-w-3xl mx-auto px-6 md:px-10 pb-10 pt-4 border-t-2 border-black mt-6">
        <Link
          href="/"
          className="inline-block text-sm font-bold border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition"
        >
          ← 返回首頁
        </Link>
      </footer>
    </main>
  );
}
