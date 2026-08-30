const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

// Restore the old UI by deleting the admin setup block completely.
code = code.replace(
  /\{\/\* Admin Setup Alert \(Only shows if VITE_FACEBOOK_APP_ID is missing\) \*\/\}[\s\S]*?\{\/\* 1-Click Action Buttons \(Customer View\) \*\/\}/g,
  `{/* 1-Click Action Buttons */}`
);

code = code.replace(
  /\{\!showAppIdInput && \(\s+(<div className="flex flex-wrap items-center gap-3 pt-2">[\s\S]*?<\/div>)\s+\)\}/g,
  `$1`
);

// We need to change `handleOneClickFacebookAuth` so that if appId is empty, it uses `window.prompt` instead of setting `showAppIdInput(true)`.

code = code.replace(
  /const handleOneClickFacebookAuth = \(\) => \{\s+if \(!appId\) \{\s+setShowAppIdInput\(true\);\s+return;\s+\}/,
  `const handleOneClickFacebookAuth = () => {
    let currentAppId = appId;
    if (!currentAppId) {
      const prompted = window.prompt("ระบบตรวจไม่พบ Facebook App ID\\nกรุณาระบุ App ID ของคุณ (เพื่อจำลองการตั้งค่าแบบ Kaojao):");
      if (!prompted) return;
      currentAppId = prompted.trim();
      setAppId(currentAppId);
    }`
);

// Change `appId.trim()` to `currentAppId` in the rest of `handleOneClickFacebookAuth`
code = code.replace(
  /\/\/ Save App ID for future uses\s+localStorage\.setItem\('fb_app_id', appId\.trim\(\)\);\s+setIsConnectingFb\(true\);\s+setTestResult\(null\);\s+if \(!\(window as any\)\.FB\) \{[\s\S]*?try \{\s+\/\/ Initialize FB synchronously just before login\s+try \{\s+\(window as any\)\.FB\.init\(\{\s+appId: appId\.trim\(\),/s,
  `// Save App ID for future uses
    localStorage.setItem('fb_app_id', currentAppId);
    setIsConnectingFb(true);
    setTestResult(null);

    if (!(window as any).FB) {
      setTestResult('❌ ระบบกำลังโหลด Facebook SDK กรุณารอสักครู่แล้วกดอีกครั้ง');
      setIsConnectingFb(false);
      return;
    }

    try {
      // Initialize FB synchronously just before login
      try {
        (window as any).FB.init({
          appId: currentAppId,`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
