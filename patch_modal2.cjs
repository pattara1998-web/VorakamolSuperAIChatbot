const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

// Replace the initFacebookSdk function and its usage with synchronous init.
// Also add useEffect to load the script.

code = code.replace(
  /const initFacebookSdk = [\s\S]*?  };/,
  `// Pre-load Facebook SDK script on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('facebook-jssdk')) {
      (window as any).fbAsyncInit = function() {
        // SDK is loaded but not initialized until we have appId
      };
      (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) { return; }
        js = d.createElement(s) as HTMLScriptElement;
        js.id = id;
        js.src = "https://connect.facebook.net/en_US/sdk.js";
        fjs.parentNode!.insertBefore(js, fjs);
      }(document, 'script', 'facebook-jssdk'));
    }
  }, []);`
);

code = code.replace(
  /const handleOneClickFacebookAuth = async \(\) => \{[\s\S]*?try \{[\s\S]*?await initFacebookSdk\(appId\.trim\(\)\);/,
  `const handleOneClickFacebookAuth = () => {
    if (!appId) {
      setShowAppIdInput(true);
      return;
    }
    
    // Save App ID for future uses
    localStorage.setItem('fb_app_id', appId.trim());
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
          appId: appId.trim(),
          cookie: true,
          xfbml: true,
          version: 'v18.0'
        });
      } catch (e) {
        // Ignore initialization errors if already initialized
      }`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
