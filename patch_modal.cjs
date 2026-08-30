const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /<p className="text-\[11px\] text-slate-500 dark:text-zinc-400 mb-3">[\s\S]*?<\/p>/,
  `<div className="mb-3">
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mb-2 mt-1">
                      โปรดระบุ <strong>Facebook App ID</strong> ที่สร้างจาก Meta for Developers
                    </p>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-2.5 rounded-lg mb-3">
                      <p className="text-[11px] text-yellow-800 dark:text-yellow-400 leading-relaxed font-medium">
                        <strong>วิธีตั้งค่า:</strong><br />
                        1. ไปที่ developers.facebook.com และสร้างแอป<br />
                        2. เพิ่มผลิตภัณฑ์ "Facebook Login" <br />
                        3. นำ URL ด้านล่างนี้ไปใส่ในช่อง "Valid OAuth Redirect URIs":<br />
                        <code className="bg-white dark:bg-black/40 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400 mt-1 inline-block select-all">{currentOrigin}</code>
                      </p>
                    </div>
                  </div>`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
