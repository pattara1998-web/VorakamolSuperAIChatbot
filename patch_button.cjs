const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /<button\s+onClick=\{handleOneClickFacebookAuth\}[\s\S]*?disabled=\{isConnectingFb\}[\s\S]*?className="px-5 py-2\.5 bg-\[#1877F2\] hover:bg-\[#166fe5\] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-2 transition-all active:scale-95"[\s\S]*?>[\s\S]*?<RefreshCw className={`w-4 h-4 \$\{isConnectingFb \? 'animate-spin' : ''\}`} \/>[\s\S]*?<span>\{isConnectingFb \? 'กำลังเปิดหน้าต่าง Login\.\.\.' : '🔄 ซิงค์เพจ Facebook \(Real OAuth\)'\}<\/span>[\s\S]*?<\/button>/,
  `<button
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
                  </button>`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
