const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /<span className="px-3 py-1 bg-emerald-100.*?เชื่อมต่อสำเร็จแล้ว\s*<\/span>/s,
  `{isConnected ? (
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 rounded-full text-xs font-bold font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    เชื่อมต่อสำเร็จแล้ว
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 rounded-full text-xs font-bold font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    รอการเชื่อมต่อ
                  </span>
                )}`
);

code = code.replace(
  /ระบบได้รับสิทธิ์ในการจัดการข้อความ Inbox, ตอบกลับคอมเมนต์, และส่งรูปภาพอัตโนมัติสำหรับเพจที่คุณเป็นผู้ดูแลทั้งหมดแล้ว \(\{pages\.length\} เพจ\)/g,
  `{isConnected
                  ? \`ระบบได้รับสิทธิ์ในการจัดการข้อความ Inbox, ตอบกลับคอมเมนต์, และส่งรูปภาพอัตโนมัติสำหรับเพจที่คุณเป็นผู้ดูแลทั้งหมดแล้ว (\${pages.length} เพจ)\`
                  : 'กรุณากดเชื่อมต่อเพื่อขอสิทธิ์ในการจัดการข้อความ Inbox, ตอบกลับคอมเมนต์, และส่งรูปภาพอัตโนมัติสำหรับเพจที่คุณดูแล'}`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
