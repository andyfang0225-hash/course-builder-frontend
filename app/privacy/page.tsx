import Link from 'next/link';

export const metadata = {
  title: '隱私權政策｜專屬課程建構室',
  description: '專屬課程建構室隱私權政策 (Privacy Policy)',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <header className="border-b-2 border-black p-4 sticky top-0 bg-white z-50 flex items-center justify-between">
        <h1 className="font-bold text-xl tracking-wider">隱私權政策</h1>
        <Link
          href="/"
          className="text-sm font-bold border-2 border-black px-4 py-1 hover:bg-black hover:text-white transition"
        >
          ← 返回首頁
        </Link>
      </header>

      <article className="max-w-3xl mx-auto p-6 md:p-10 leading-relaxed space-y-6">
        <section className="space-y-3">
          <h2 className="text-2xl font-bold border-b-2 border-black pb-2">隱私權政策 (Privacy Policy)</h2>
          <p>
            <strong>專屬課程建構室</strong>（以下簡稱「本平台」）非常重視您的隱私權。本政策說明我們如何蒐集、處理、利用您的資料，以及我們使用的第三方服務。
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">1. 我們蒐集的資料</h3>
          <p>當您使用本平台時，我們會蒐集以下資料：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Google 登入資訊：</strong>
              當您透過 Google 登入時，我們會取得您的基本公開資訊，包括：電子郵件地址、姓名、個人頭像。
            </li>
            <li>
              <strong>平台使用數據：</strong>
              您輸入用來生成課程的指令（Prompts）、學習進度、測驗結果、退款問卷內容及平台操作紀錄。
            </li>
            <li>
              <strong>交易資料：</strong>
              若有付費行為，我們會記錄您的訂單狀態（信用卡等詳細支付資訊由第三方金流平台處理，本平台不儲存您的完整信用卡號）。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">2. 資料儲存與第三方服務提供者</h3>
          <p>為維持平台運作，我們使用了以下第三方服務，並將您的部分資料傳送或儲存於此：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Supabase（雲端資料庫）：</strong>
              您的使用者資料、生成的課程內容與平台紀錄，均安全儲存於 Supabase 提供的雲端資料庫中。
            </li>
            <li>
              <strong>Google Gemini API（AI 引擎）：</strong>
              您輸入的「課程生成指令（Prompts）」將會傳送至 Google Gemini API 進行處理，以生成您的專屬課程。請避免在指令中輸入您的身分證字號、銀行帳號等高度敏感的個人隱私資訊。
            </li>
            <li>
              <strong>Google OAuth（身分驗證）：</strong>
              用於處理您的登入驗證。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">3. 資料使用目的</h3>
          <p>我們蒐集與處理您的資料，僅用於以下目的：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>驗證您的身分並提供 Google 快速登入。</li>
            <li>透過 AI 技術為您生成客製化的課程內容。</li>
            <li>儲存您的學習歷程，確保您能隨時存取專屬課程。</li>
            <li>處理退款問卷、優化 AI 生成指令系統、改善平台整體服務品質。</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">4. 資料分享與保護</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>個人營運聲明：</strong>
              本平台由個人營運，除上述必須使用的第三方服務供應商（Supabase、Google）以及法律明文規定外，我們絕對不會將您的個人資料出售、交換或洩漏給其他不相關的第三方或企業。
            </li>
            <li>
              我們依賴 Supabase 提供的安全機制與資料庫權限控管來保護您的資料安全。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">5. 您的資料權利</h3>
          <p>針對您的個人資料，您享有以下權利：</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>查閱您的個人資料。</li>
            <li>請求修改不正確的資料。</li>
            <li>
              <strong>請求刪除帳號及資料：</strong>
              若您希望永久刪除您的帳號及儲存於 Supabase 上的所有相關資料，請透過下方聯絡方式通知我們。
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">6. 政策修改</h3>
          <p>
            本平台保留隨時修改本隱私權政策的權利。政策更新時，我們將於平台上公告。繼續使用本服務即代表您同意更新後的政策。
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="text-lg font-bold border-l-4 border-black pl-3">7. 聯絡我們</h3>
          <p>若您對本隱私權政策、資料處理、或退款機制有任何疑問，請與我們聯絡：</p>
          <ul className="list-none pl-0 space-y-2 border-2 border-black p-4 bg-gray-50">
            <li>
              <strong>平台營運者：</strong>andy
            </li>
            <li>
              <strong>客服 / 聯絡信箱：</strong>
              <a
                href="mailto:d94309793@gmail.com"
                className="underline hover:bg-black hover:text-white"
              >
                d94309793@gmail.com
              </a>
            </li>
          </ul>
        </section>

        <p className="text-sm text-gray-600 pt-4 border-t border-gray-300">
          最後更新日期：2026 年 4 月 26 日
        </p>
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
