const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

// Replace state variables
code = code.replace(
  /const \[appId, setAppId\] = useState\([\s\S]*?\}\);\n  const \[showAppIdInput, setShowAppIdInput\] = useState\(false\);/,
  `const envAppId = import.meta.env.VITE_FACEBOOK_APP_ID || '';
  const [appId, setAppId] = useState(envAppId); // Can still be overridden in UI if needed for testing
  const [showAppIdInput, setShowAppIdInput] = useState(!envAppId);`
);

// We need to update the handleOneClickFacebookAuth function logic if needed, but it already checks if (!appId) { setShowAppIdInput(true); return; }. 
// So let's just modify the UI to look much cleaner.
// Find the "Facebook App ID Input Prompt" section and replace it with a cleaner "Admin Setup" view.

code = code.replace(
  /\{\/\* Facebook App ID Input Prompt \*\/\}[\s\S]*?\{\/\* 1-Click Action Buttons \*\/\}/,
  `{/* Admin Setup Alert (Only shows if VITE_FACEBOOK_APP_ID is missing) */}
              {showAppIdInput && (
                <div className="mt-4 p-4 bg-white dark:bg-[#1A1A20] rounded-xl border border-blue-200 dark:border-blue-900/50 shadow-inner">
                  <h5 className="text-sm font-bold text-slate-800 dark:text-zinc-100 mb-2 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    โหมดผู้ดูแลระบบ: ตั้งค่า Facebook App ID
                  </h5>
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3 mt-1 leading-relaxed">
                      เพื่อให้ลูกค้าของคุณสามารถกดเชื่อมต่อได้แบบ <b>"คลิกเดียว (1-Click)"</b> เหมือนระบบ Kaojao คุณต้องฝัง App ID ของคุณลงในระบบก่อน
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-3 rounded-lg mb-4">
                      <p className="text-xs text-yellow-800 dark:text-yellow-400 leading-relaxed font-medium">
                        <strong>ขั้นตอนสำหรับแอดมิน:</strong><br />
                        1. ไปที่ <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="underline text-blue-600 dark:text-blue-400 font-bold">Meta for Developers (คลิกที่นี่)</a><br />
                        2. สร้างแอปประเภท "ธุรกิจ (Business)"<br />
                        3. นำ URL ด้านล่างไปใส่ในการตั้งค่า Facebook Login:<br />
                        <code className="bg-white dark:bg-black/40 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 mt-1.5 inline-block select-all">{currentOrigin}</code><br />
                        4. นำ App ID มาใส่ด้านล่าง (สำหรับการทดสอบ) หรือใส่ในตัวแปร <code className="bg-white dark:bg-black/40 px-1 py-0.5 rounded">VITE_FACEBOOK_APP_ID</code> เพื่อให้ระบบจำถาวร
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="วาง Facebook App ID ของคุณที่นี่..."
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-zinc-100"
                    />
                    <button
                      onClick={handleOneClickFacebookAuth}
                      disabled={!appId}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      บันทึก & ทดสอบ
                    </button>
                  </div>
                </div>
              )}

              {/* 1-Click Action Buttons (Customer View) */}`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
