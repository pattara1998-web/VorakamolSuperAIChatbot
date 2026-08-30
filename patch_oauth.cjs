const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

// Replace the existing useEffect for hash parsing
code = code.replace(
  /useEffect\(\(\) => \{\s*if \(typeof window !== 'undefined' && window\.location\.hash\.includes\('access_token'\)\) \{[\s\S]*?\}\s*\}, \[onImportPages\]\);/,
  `// Handle OAuth callback in popup OR listen for message in parent
  useEffect(() => {
    // 1. If we are inside the popup and have the access token
    if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      
      if (accessToken && window.opener) {
        // Send token to parent and close popup
        window.opener.postMessage({ type: 'FB_AUTH_SUCCESS', accessToken }, '*');
        window.close();
        return;
      }
    }

    // 2. Listen for messages from the popup
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'FB_AUTH_SUCCESS') {
        const { accessToken } = event.data;
        setIsConnectingFb(true);
        
        fetch(\`https://graph.facebook.com/v18.0/me/accounts?access_token=\${accessToken}&fields=id,name,picture,category,access_token\`)
          .then(res => res.json())
          .then(data => {
            if (data.data) {
              const newPages = data.data.map((fbPage: any) => ({
                page_id: fbPage.id,
                page_name: fbPage.name,
                page_access_token: fbPage.access_token,
                verify_token: 'FB_AI_SALES_TOKEN_2026',
                is_active: true,
                ai_persona: \`คุณคือแอดมินเพจ \${fbPage.name} ตอบคำถามลูกค้าอย่างสุภาพและปิดการขาย\`,
                category: 'GENERAL',
                page_avatar: fbPage.picture?.data?.url || ''
              }));
              
              if (onImportPages) {
                onImportPages(newPages);
              }
              setSyncedCount(newPages.length);
              setIsConnected(true);
              setTestResult('🎉 ซิงค์เพจ Facebook สำเร็จเรียบร้อย! ระบบดึงข้อมูลเพจและ Access Token มาให้แล้ว พร้อมใช้งาน AI ปิดการขายทันที');
            } else {
              setTestResult('⚠️ ไม่พบข้อมูลเพจ หรือ Access Token ไม่ถูกต้อง: ' + JSON.stringify(data));
            }
          })
          .catch(err => {
            setTestResult('❌ เกิดข้อผิดพลาดในการดึงข้อมูลเพจ: ' + err.message);
          })
          .finally(() => {
            setIsConnectingFb(false);
          });
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onImportPages]);`
);

// Replace window.location.href = fbAuthUrl; with window.open
code = code.replace(
  /\/\/ Open in a new tab\/popup or redirect the current page[\s\S]*?window\.location\.href = fbAuthUrl;/,
  `const popup = window.open(fbAuthUrl, 'fb_oauth', 'width=600,height=700');
    if (!popup) {
      alert('กรุณาอนุญาตให้แสดง Pop-up (Allow Pop-ups) สำหรับเว็บไซต์นี้เพื่อเข้าสู่ระบบ Facebook');
      setIsConnectingFb(false);
    }`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
