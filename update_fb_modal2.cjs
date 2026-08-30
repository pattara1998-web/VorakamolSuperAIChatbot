const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

// Restore state variables
code = code.replace(
  /const envAppId = import\.meta\.env\.VITE_FACEBOOK_APP_ID \|\| '';\s+const \[appId, setAppId\] = useState\(envAppId\);(?:.*?)\n\s+const \[showAppIdInput, setShowAppIdInput\] = useState\(!envAppId\);/s,
  `const envAppId = import.meta.env.VITE_FACEBOOK_APP_ID || '';
  const [appId, setAppId] = useState(() => {
    if (typeof window !== 'undefined') {
      return envAppId || localStorage.getItem('fb_app_id') || '';
    }
    return envAppId;
  });`
);

// Update handleOneClickFacebookAuth
code = code.replace(
  /const handleOneClickFacebookAuth = \(\) => \{\s+if \(\!appId\) \{\s+setShowAppIdInput\(true\);\s+return;\s+\}/,
  `const handleOneClickFacebookAuth = () => {
    let currentAppId = appId;
    if (!currentAppId) {
      const promptedId = window.prompt("ระบบตรวจไม่พบ Facebook App ID\\nกรุณาระบุ App ID ของคุณ (สำหรับแอดมินตั้งค่าครั้งแรก):");
      if (!promptedId) return;
      currentAppId = promptedId.trim();
      setAppId(currentAppId);
    }`
);

// Update the rest of handleOneClickFacebookAuth to use currentAppId
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

// Remove the Admin Setup Alert block and the 1-Click Action Buttons wrapper condition
code = code.replace(
  /\{\/\* Admin Setup Alert \(Only shows if VITE_FACEBOOK_APP_ID is missing\) \*\/\}.*?\{\/\* 1-Click Action Buttons \(Customer View\) \*\/\}/s,
  `{/* 1-Click Action Buttons */}`
);

code = code.replace(
  /\{\!showAppIdInput && \(\s+(<div className="flex flex-wrap items-center gap-3 pt-2">[\s\S]*?<\/div>)\s+\)\}/,
  `$1`
);


fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
