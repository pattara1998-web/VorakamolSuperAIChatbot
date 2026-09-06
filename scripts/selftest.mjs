#!/usr/bin/env node
/**
 * Self-Test CLI — รันชุดทดสอบระบบจาก command line
 * ใช้หลังแก้ไขโค้ดทุกครั้ง: npm run selftest
 * (ต้องมีเซิร์ฟเวอร์รันอยู่ก่อน: npm start หรือ npm run dev)
 *
 * รายงานฉบับเต็มถูกเขียนที่ reports/ ทั้งไฟล์ timestamp และ selftest-latest.md
 */

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.SELFTEST_URL || `http://127.0.0.1:${PORT}`;

async function main() {
  console.log(`🧪 Self-Test: กำลังทดสอบระบบที่ ${BASE_URL} ...\n`);

  // Health pre-check
  try {
    const h = await fetch(`${BASE_URL}/api/health`).then(r => r.json());
    console.log(`   server: ${h.status} • ai_configured: ${h.ai_configured}\n`);
  } catch {
    console.error(`❌ เชื่อมต่อเซิร์ฟเวอร์ที่ ${BASE_URL} ไม่ได้ — รัน "npm start" (หรือตั้ง PORT) ก่อน`);
    process.exit(2);
  }

  const res = await fetch(`${BASE_URL}/api/selftest`, { method: 'POST' }).catch(() => null);
  if (!res || !res.ok) {
    const body = res ? await res.text().catch(() => '') : '';
    console.error(`❌ รันการทดสอบไม่สำเร็จ (HTTP ${res?.status}): ${body.slice(0, 300)}`);
    process.exit(2);
  }

  const { report } = await res.json();
  const icon = (s) => (s === 'PASS' ? '✅' : s === 'WARN' ? '⚠️' : '❌');

  console.log('ผลการทดสอบแบบกลุ่ม:\n');
  let lastGroup = '';
  for (const r of report.results) {
    if (r.group !== lastGroup) { console.log(`\n── ${r.group} ──`); lastGroup = r.group; }
    console.log(`${icon(r.status)} ${r.name} (${r.durationMs}ms) — ${r.detail}`);
    if (r.error) console.log(`     ↳ error: ${r.error}`);
    if (r.fixHint) console.log(`     ↳ วิธีแก้: ${r.fixHint}`);
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`สรุป: ✅ ผ่าน ${report.summary.pass} | ⚠️ เตือน ${report.summary.warn} | ❌ พัง ${report.summary.fail} (ทั้งหมด ${report.summary.total}) ใช้เวลา ${(report.totalMs / 1000).toFixed(1)}s`);
  console.log(`📄 รายงานฉบับเต็ม: ${report.reportPath}`);
  console.log(`📄 ฉบับล่าสุด: reports/selftest-latest.md`);

  process.exit(report.summary.fail > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('selftest error:', err);
  process.exit(2);
});
