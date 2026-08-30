const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

const correctStructure = `
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 1028347823948"
                      value={appId}
                      onChange={(e) => setAppId(e.target.value)}
                      className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-blue-500 text-slate-900 dark:text-zinc-100"
                    />
                    <button
                      onClick={handleOneClickFacebookAuth}
                      disabled={!appId}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      เชื่อมต่อ
                    </button>
                  </div>
                </div>
              )}

              {/* 1-Click Action Buttons */}
              {!showAppIdInput && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleOneClickFacebookAuth}
                    disabled={isConnectingFb}
                    className="px-5 py-2.5 bg-[#1877F2] hover:bg-[#166fe5] text-white text-sm font-bold rounded-lg shadow-sm flex items-center gap-2.5 transition-all active:scale-95"
                  >
                    {isConnectingFb ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Facebook className="w-5 h-5 fill-current" />
                    )}
                    <span>{isConnectingFb ? 'กำลังเปิดหน้าต่าง Login...' : 'Continue with Facebook'}</span>
                  </button>
                </div>
              )}
            </div>
`;

// I need to replace from `<div className="flex gap-2">` to the closing `</div>` right before `{/* Managed Pages Preview */}`
code = code.replace(
  /<div className="flex gap-2">[\s\S]*?\{\/\* Managed Pages Preview \*\/\}/,
  correctStructure.trim() + '\n\n            {/* Managed Pages Preview */}'
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
