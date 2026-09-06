import React, { useState } from 'react';
import { X, FlaskConical, CheckCircle2, AlertTriangle, XCircle, Download, Loader2 } from 'lucide-react';

interface SelfTestResult {
  id: string;
  group: string;
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  durationMs: number;
  detail: string;
  error?: string;
  fixHint?: string;
}

interface SelfTestReport {
  startedAt: string;
  totalMs: number;
  summary: { total: number; pass: number; fail: number; warn: number };
  environment: Record<string, any>;
  results: SelfTestResult[];
  reportPath: string;
}

interface SelfTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
}

export const SelfTestModal: React.FC<SelfTestModalProps> = ({ isOpen, onClose, theme }) => {
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SelfTestReport | null>(null);
  const [error, setError] = useState('');

  const runTests = async () => {
    setRunning(true);
    setError('');
    setReport(null);
    try {
      const res = await fetch('/api/selftest', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setReport(data.report);
      else setError(data.message || 'รันการทดสอบไม่สำเร็จ');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ');
    } finally {
      setRunning(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const lines: string[] = [
      `# รายงานผลการทดสอบระบบ (Self-Test)`,
      ``,
      `- วันที่: ${new Date(report.startedAt).toLocaleString('th-TH')}`,
      `- ใช้เวลา: ${(report.totalMs / 1000).toFixed(1)} วินาที`,
      `- ผลรวม: ✅ ผ่าน ${report.summary.pass} / ⚠️ เตือน ${report.summary.warn} / ❌ พัง ${report.summary.fail} (ทั้งหมด ${report.summary.total})`,
      `- สภาพแวดล้อม: Node ${report.environment.nodeVersion} • DB: ${report.environment.database} • AI: ${report.environment.aiProvider}`,
      ``,
      `## ผลรายการ`,
      ``
    ];
    for (const r of report.results) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'WARN' ? '⚠️' : '❌';
      lines.push(`${icon} [${r.status}] (${r.group}) ${r.name} — ${r.detail} (${r.durationMs}ms)`);
      if (r.error) lines.push(`   Error: ${r.error}`);
      if (r.fixHint) lines.push(`   วิธีแก้: ${r.fixHint}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `รายงานผลการทดสอบ-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const badge = (status: string) => {
    const map: Record<string, { icon: any; cls: string }> = {
      PASS: { icon: CheckCircle2, cls: 'text-emerald-500' },
      WARN: { icon: AlertTriangle, cls: 'text-amber-500' },
      FAIL: { icon: XCircle, cls: 'text-rose-500' }
    };
    const { icon: Icon, cls } = map[status] || map.WARN;
    return <Icon className={`w-4 h-4 shrink-0 ${cls}`} />;
  };

  const groups = report ? Array.from(new Set(report.results.map(r => r.group))) : [];

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white dark:bg-[#121216] border border-slate-200 dark:border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-zinc-100 text-sm">Self-Test — ระบบทดสอบตัวเอง</h3>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400">ตรวจทุกฟังก์ชัน: ฐานข้อมูล, API, Webhook, AI Provider, Backup</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={runTests}
              disabled={running}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
              {running ? 'กำลังทดสอบทุกฟังก์ชัน...' : report ? 'รันการทดสอบอีกครั้ง' : 'เริ่มทดสอบทั้งระบบ'}
            </button>
            {report && (
              <button onClick={downloadReport} className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:border-violet-400 transition-colors">
                <Download className="w-3.5 h-3.5" /> ดาวน์โหลดรายงาน
              </button>
            )}
          </div>

          {error && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs">{error}</div>
          )}

          {running && (
            <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs leading-relaxed">
              กำลังจำลองการใช้งานจริง: ทดสอบ health, PostgreSQL, login, ตารางทั้งหมด, API endpoints, webhook ตอบแชทครบวงจร, AI provider, backup...<br />
              <span className="text-[10px] opacity-75">ใช้เวลาประมาณ 20-40 วินาที อย่าปิดหน้านี้</span>
            </div>
          )}

          {report && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'ผ่าน', value: report.summary.pass, cls: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' },
                  { label: 'เตือน', value: report.summary.warn, cls: 'text-amber-500 border-amber-500/20 bg-amber-500/5' },
                  { label: 'พัง', value: report.summary.fail, cls: 'text-rose-500 border-rose-500/20 bg-rose-500/5' },
                  { label: 'รวม', value: report.summary.total, cls: 'text-indigo-500 border-indigo-500/20 bg-indigo-500/5' }
                ].map(s => (
                  <div key={s.label} className={`rounded-xl border p-3 text-center ${s.cls}`}>
                    <div className="text-xl font-black">{s.value}</div>
                    <div className="text-[10px] font-bold">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                ทดสอบเมื่อ {new Date(report.startedAt).toLocaleString('th-TH')} • ใช้เวลา {(report.totalMs / 1000).toFixed(1)} วิ • รายงานถูกบันทึกที่ <code className="text-violet-500">{report.reportPath}</code>
              </div>

              {groups.map(group => (
                <div key={group} className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-[#16161C] text-[10px] font-bold text-slate-600 dark:text-zinc-300">{group}</div>
                  <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                    {report.results.filter(r => r.group === group).map(r => (
                      <div key={r.id} className="px-3 py-2.5 flex items-start gap-2.5">
                        {badge(r.status)}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-800 dark:text-zinc-100">{r.name} <span className="text-[9px] font-normal text-slate-400">({r.durationMs}ms)</span></div>
                          <div className="text-[10px] text-slate-500 dark:text-zinc-400 break-words">{r.detail}</div>
                          {r.error && <div className="text-[10px] text-rose-500 break-words mt-0.5">Error: {r.error}</div>}
                          {r.fixHint && <div className="text-[10px] text-amber-600 dark:text-amber-400 break-words mt-0.5">วิธีแก้: {r.fixHint}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
