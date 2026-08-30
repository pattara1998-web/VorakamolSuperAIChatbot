const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /\/\/ Pre-load Facebook SDK script on mount[\s\S]*?\}\);\n  \};\n\n  const copyToClipboard/,
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
  }, []);

  const copyToClipboard`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
