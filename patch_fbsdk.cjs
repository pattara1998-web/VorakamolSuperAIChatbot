const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /\(window as any\)\.FB\.login\(\(response: any\) => \{[\s\S]*?\}, \{ scope: 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging' \}\);/,
  `(window as any).FB.login((response: any) => {
        if (response.authResponse) {
          const accessToken = response.authResponse.accessToken;
          // Save the user access token securely
          localStorage.setItem('fb_user_access_token', accessToken);
          fetchPages(accessToken);
        } else {
          setTestResult('⚠️ ผู้ใช้ยกเลิกการเข้าสู่ระบบ หรือให้สิทธิ์ไม่ครบถ้วน');
          setIsConnectingFb(false);
        }
      }, { scope: 'pages_show_list,pages_manage_metadata,pages_read_engagement,pages_messaging,manage_pages' });`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
