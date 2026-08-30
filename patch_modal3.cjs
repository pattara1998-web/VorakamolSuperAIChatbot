const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /const \[isConnected, setIsConnected\] = useState\(false\);/,
  `const [isConnected, setIsConnected] = useState(pages && pages.length > 0 && pages[0].page_access_token !== 'EAA_MOCK_TOKEN');`
);

code = code.replace(
  /เพจที่คุณเป็นผู้ดูแลทั้งหมดแล้ว \(\{pages\.length\} เพจ\)/g,
  `เพจที่คุณเป็นผู้ดูแลทั้งหมดแล้ว (\${pages.length} เพจ)`
);

code = code.replace(
  /Somkiat E-Commerce Official \(Verified\)/,
  `{pages && pages.length > 0 ? pages[0].page_name : 'เชื่อมต่อบัญชี Facebook ของคุณ'}`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
