import React, { useEffect, useRef, useState } from 'react';
import {
  Megaphone, Search, FileVideo, ImageIcon, File as FileIcon, Play, Square,
  CheckCircle2, XCircle, Loader2, AlertTriangle, Users, Clock, Star
} from 'lucide-react';
import type { PageConfig } from '../types';

interface BroadcastTabProps {
  pages: PageConfig[];
  selectedPageId: string;
  setSelectedPageId?: (id: string) => void;
  theme: 'dark' | 'light';
}

interface ScanResult {
  total: number;
  targets: Array<{ sender_id: string; name: string; last_message_at: string; starred: boolean }>;
}

interface JobStatus {
  id: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  running: boolean;
  stopped: boolean;
  finished: boolean;
  current?: string;
  errors: Array<{ sender_id: string; error: string }>;
}

const MAX_FILE_MB = 500;

export const BroadcastTab: React.FC<BroadcastTabProps> = ({ pages, selectedPageId, setSelectedPageId, theme }) => {
  const dark = theme === 'dark';
  const subtle = dark ? 'text-zinc-400' : 'text-slate-500';
  const card = dark ? 'bg-[#0F0F12] border-zinc-800' : 'bg-white border-slate-200';
  const inputCls = `rounded-lg px-3 py-2 text-xs border outline-none ${dark ? 'bg-[#16161C] border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:border-indigo-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-500'}`;

  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [starFilter, setStarFilter] = useState<'any' | 'only' | 'none'>('any');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [attachment, setAttachment] = useState<{ id: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [delaySec, setDelaySec] = useState(4);
  const [batchSize, setBatchSize] = useState(50);
  const [batchPauseSec, setBatchPauseSec] = useState(60);
  const [tag, setTag] = useState('');
  const [jobId, setJobId] = useState('');
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setScan(null); setAttachment(null); setFile(null); setJobId(''); setStatus(null); }, [selectedPageId]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const doScan = async () => {
    setScanning(true); setError(''); setInfo('');
    try {
      const res = await fetch('/api/broadcast/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page_id: selectedPageId, since: since || undefined, until: until || undefined, starred: starFilter })
      });
      const data = await res.json();
      if (data.success) { setScan({ total: data.total, targets: data.targets || [] }); setInfo(`สแกนเสร็จ: พบลูกค้าเป้าหมาย ${data.total} คน`); }
      else setError(data.message || 'สแกนไม่สำเร็จ');
    } catch { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'); }
    finally { setScanning(false); }
  };

  const doUpload = async () => {
    if (!file) return;
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`ไฟล์ใหญ่เกิน ${MAX_FILE_MB}MB — โปรแกรมจำกัดไว้เพื่อความเสถียร`);
      return;
    }
    setUploading(true); setError(''); setInfo('');
    try {
      const buf = await file.arrayBuffer();
      const res = await fetch(`/api/broadcast/upload?page_id=${encodeURIComponent(selectedPageId)}&filename=${encodeURIComponent(file.name)}&mime=${encodeURIComponent(file.type || 'application/octet-stream')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buf
      });
      const data = await res.json();
      if (data.success) {
        setAttachment({ id: data.attachment_id, type: data.attachment_type });
        setInfo(`อัปโหลดไฟล์สำเร็จ (${(file.size / 1048576).toFixed(1)}MB) — ระบบจะใช้ไฟล์นี้ส่งทุกเป้าหมาย`);
      } else setError(data.message || 'อัปโหลดไม่สำเร็จ');
    } catch { setError('อัปโหลดไม่สำเร็จ — ไฟล์อาจใหญ่เกินไป'); }
    finally { setUploading(false); }
  };

  const startBroadcast = async () => {
    setError(''); setInfo('');
    if (scan === null) { setError('กด "สแกนลูกค้า" ก่อนเริ่มส่ง เพื่อยืนยันกลุ่มเป้าหมาย'); return; }
    if (!text.trim() && !attachment) { setError('ใส่ข้อความหรือแนบไฟล์อย่างน้อย 1 อย่าง'); return; }
    const ok = window.confirm(`ยืนยันส่ง Broadcast ไป ${scan.total} ลูกค้า?\n\nความเร็ว: ทุก ${delaySec} วินาที (พักชุดทุก ${batchSize} คน)`);
    if (!ok) return;
    try {
      const res = await fetch('/api/broadcast/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: selectedPageId,
          targets: scan.targets.map(t => t.sender_id),
          text: text.trim() || undefined,
          attachment_id: attachment?.id,
          attachment_type: attachment?.type,
          tag: tag || undefined,
          delay_ms: delaySec * 1000,
          batch_size: batchSize,
          batch_pause_ms: batchPauseSec * 1000
        })
      });
      const data = await res.json();
      if (data.success) {
        setJobId(data.job_id);
        setInfo(`เริ่มส่งแล้ว — ติดตามความคืบหน้าด้านล่าง`);
        pollRef.current = setInterval(async () => {
          const s = await fetch(`/api/broadcast/status?job_id=${data.job_id}`).then(r => r.json()).catch(() => null);
          if (s?.success) {
            setStatus(s.job);
            if (!s.job.running) clearInterval(pollRef.current);
          }
        }, 1000);
      } else setError(data.message || 'เริ่มส่งไม่สำเร็จ');
    } catch { setError('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ'); }
  };

  const stopBroadcast = async () => {
    if (!jobId) return;
    await fetch('/api/broadcast/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: jobId }) });
    setInfo('สั่งหยุดแล้ว — รอข้อความปัจจุบันเสร็จ');
  };

  const fileIcon = () => {
    if (!file) return <FileIcon className="w-4 h-4" />;
    if (file.type.startsWith('video')) return <FileVideo className="w-4 h-4" />;
    if (file.type.startsWith('image')) return <ImageIcon className="w-4 h-4" />;
    return <FileIcon className="w-4 h-4" />;
  };

  const progress = status ? Math.round(((status.sent + status.failed + status.skipped) / Math.max(1, status.total)) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-orange-950/40 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
          <Megaphone className="w-5 h-5" />
        </div>
        <div>
          <h2 className={`text-lg font-bold ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>Broadcast ลูกค้า</h2>
          <p className={`text-xs ${subtle}`}>ส่งข้อความ/รูป/วิดีโอ หาลูกค้าเก่าในเพจแบบหมู่ — สแกนก่อน ส่งต่อเนื่อง ป้องกันโดนแบน</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ============ LEFT: audience + content ============ */}
        <div className="space-y-4">
          {/* Step 1: audience */}
          <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2"><Users className="w-4 h-4 text-indigo-500" /> 1. เลือกกลุ่มลูกค้า</h3>
            <select
              value={selectedPageId}
              onChange={e => setSelectedPageId?.(e.target.value)}
              className={`w-full ${inputCls}`}
            >
              {pages.map(p => <option key={p.page_id} value={p.page_id}>{p.page_name}{p.is_active === false ? ' (ปิดใช้งาน)' : ''}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`text-[10px] font-bold block mb-1 ${subtle}`}>เคยทักตั้งแต่</label>
                <input type="date" value={since} onChange={e => setSince(e.target.value)} className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className={`text-[10px] font-bold block mb-1 ${subtle}`}>ถึง</label>
                <input type="date" value={until} onChange={e => setUntil(e.target.value)} className={`w-full ${inputCls}`} />
              </div>
            </div>
            <div>
              <label className={`text-[10px] font-bold block mb-1 ${subtle}`}>สถานะติดดาว</label>
              <div className="flex gap-1.5">
                {[['any', 'ทั้งหมด'], ['only', 'เฉพาะที่ติดดาว ⭐'], ['none', 'เฉพาะยังไม่ติดดาว']].map(([v, label]) => (
                  <button key={v} onClick={() => setStarFilter(v as any)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${starFilter === v ? 'bg-indigo-600 text-white border-indigo-600' : dark ? 'bg-[#16161C] border-zinc-800 text-zinc-300' : 'bg-white border-slate-200 text-slate-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={doScan} disabled={scanning}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold disabled:opacity-50">
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {scanning ? 'กำลังสแกนข้อมูลลูกค้า...' : 'สแกนลูกค้า (ก่อนส่งทุกครั้ง)'}
            </button>
            {scan && (
              <div className={`p-3 rounded-lg border ${dark ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'}`}>
                <p className={`text-xs font-bold ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>พบเป้าหมาย {scan.total} คน</p>
                {scan.targets.length > 0 && (
                  <p className={`text-[10px] mt-1 ${subtle} truncate`}>ตัวอย่าง: {scan.targets.slice(0, 4).map(t => t.name).join(', ')}{scan.total > 4 ? ' ...' : ''}</p>
                )}
              </div>
            )}
          </div>

          {/* Step 2: content */}
          <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2"><Megaphone className="w-4 h-4 text-orange-500" /> 2. ข้อความ / ไฟล์แนบ</h3>
            <textarea
              value={text} onChange={e => setText(e.target.value)} rows={4}
              placeholder="พิมพ์ข้อความที่จะส่ง เช่น โปรโมชั่นใหม่ ขอบคุณลูกค้าเก่า ทักทายปีใหม่..."
              className={`w-full resize-none ${inputCls}`}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileInputRef} type="file" className="hidden"
                onChange={e => { setFile(e.target.files?.[0] || null); setAttachment(null); }} />
              <button onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border ${dark ? 'bg-[#16161C] border-zinc-800 text-zinc-300 hover:border-orange-500' : 'bg-white border-slate-200 text-slate-600 hover:border-orange-400'}`}>
                {fileIcon()} เลือกไฟล์ (รูป/วิดีโอ/ไฟล์ ≤ {MAX_FILE_MB}MB)
              </button>
              {file && !attachment && (
                <button onClick={doUpload} disabled={uploading}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {uploading ? 'กำลังอัปโหลดเข้า Facebook...' : 'อัปโหลด'}
                </button>
              )}
              {file && <span className={`text-[10px] ${subtle}`}>{file.name} ({(file.size / 1048576).toFixed(1)}MB)</span>}
              {attachment && <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-500"><CheckCircle2 className="w-3.5 h-3.5" /> พร้อมส่ง ({attachment.type})</span>}
            </div>
            <p className={`text-[10px] ${subtle}`}>
              ข้อความอย่างเดียวก็ได้ ไฟล์อย่างเดียวก็ได้ หรือใส่ทั้งคู่ • วิดีโอ Facebook จำกัด 25MB/ไฟล์ — ไฟล์ที่ใหญ่กว่านี้ระบบจะข้ามพร้อมแจ้งเหตุผล
            </p>
          </div>
        </div>

        {/* ============ RIGHT: pacing + run ============ */}
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
            <h3 className="text-sm font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /> 3. ความเร็ว (ป้องกันโดนแบน)</h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={`text-[10px] font-bold block mb-1 ${subtle}`}>ทุก ๆ (วินาที)</label>
                <input type="number" min={2} value={delaySec} onChange={e => setDelaySec(Number(e.target.value) || 4)} className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className={`text-[10px] font-bold block mb-1 ${subtle}`}>พักทุก (คน)</label>
                <input type="number" min={1} value={batchSize} onChange={e => setBatchSize(Number(e.target.value) || 50)} className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className={`text-[10px] font-bold block mb-1 ${subtle}`}>พักนาน (วินาที)</label>
                <input type="number" min={5} value={batchPauseSec} onChange={e => setBatchPauseSec(Number(e.target.value) || 60)} className={`w-full ${inputCls}`} />
              </div>
            </div>
            <div>
              <label className={`text-[10px] font-bold block mb-1 ${subtle}`}>Message Tag (สำหรับลูกค้าเก่าเกิน 24 ชม.)</label>
              <select value={tag} onChange={e => setTag(e.target.value)} className={`w-full ${inputCls}`}>
                <option value="">ไม่ใช้ tag (ส่งได้เฉพาะลูกค้าที่ทักใน 24 ชม.)</option>
                <option value="HUMAN_AGENT">HUMAN_AGENT — ตอบกลับลูกค้าใน 7 วัน</option>
              </select>
              <p className={`text-[10px] mt-1 flex items-start gap-1 ${subtle}`}>
                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
                Facebook อนุญาตให้ตอบลูกค้าได้ใน 24 ชม. หลังลูกค้าทักครั้งล่าสุด — ส่งนอกหน้าต่างเวลาให้เลือก tag ที่เหมาะสมและใช้ตามนโยบาย Meta
              </p>
            </div>
            {status?.running ? (
              <button onClick={stopBroadcast} className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl text-sm font-bold">
                <Square className="w-4 h-4" /> หยุดการส่ง
              </button>
            ) : (
              <button onClick={startBroadcast} disabled={!scan || scan.total === 0 || (!text.trim() && !attachment)}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-40">
                <Play className="w-4 h-4" /> เริ่ม Broadcast ({scan?.total ?? 0} คน)
              </button>
            )}
          </div>

          {/* Progress */}
          {status && (
            <div className={`rounded-xl border p-4 space-y-3 ${card}`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                {status.running ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                ความคืบหน้า {status.finished ? '(เสร็จสิ้น)' : '(กำลังส่ง...)'}
              </h3>
              <div className={`w-full h-3 rounded-full overflow-hidden ${dark ? 'bg-zinc-800' : 'bg-slate-100'}`}>
                <div className="h-full bg-gradient-to-r from-indigo-500 to-orange-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  ['ส่งแล้ว', status.sent, 'text-emerald-500'],
                  ['พลาด', status.failed, 'text-rose-500'],
                  ['ข้าม', status.skipped, 'text-slate-400'],
                  ['รวม', status.total, 'text-indigo-500']
                ].map(([label, val, cls]) => (
                  <div key={String(label)}>
                    <div className={`text-lg font-black ${cls}`}>{val}</div>
                    <div className={`text-[10px] ${subtle}`}>{label}</div>
                  </div>
                ))}
              </div>
              {status.errors.length > 0 && (
                <div className={`p-2.5 rounded-lg text-[10px] space-y-1 max-h-32 overflow-y-auto ${dark ? 'bg-rose-950/20 text-rose-300' : 'bg-rose-50 text-rose-600'}`}>
                  {status.errors.map((e, i) => <div key={i} className="break-words">❌ {e.sender_id.slice(-6)}: {e.error}</div>)}
                </div>
              )}
            </div>
          )}

          {info && (
            <div className={`p-3 rounded-xl border text-xs ${dark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{info}</div>
          )}
          {error && (
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${dark ? 'bg-rose-950/20 border-rose-800/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
