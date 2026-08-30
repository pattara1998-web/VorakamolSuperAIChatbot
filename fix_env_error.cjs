const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /const envAppId = import\.meta\.env\.VITE_FACEBOOK_APP_ID \|\| '';/g,
  `const envAppId = (import.meta as any).env?.VITE_FACEBOOK_APP_ID || '';`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
