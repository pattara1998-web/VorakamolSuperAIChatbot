const fs = require('fs');
let code = fs.readFileSync('src/components/FacebookConnectModal.tsx', 'utf8');

code = code.replace(
  /const \[isConnected, setIsConnected\] = useState\(pages && pages\.length > 0 && pages\[0\]\.page_access_token !== 'EAA_MOCK_TOKEN'\);/,
  `const [isConnected, setIsConnected] = useState(pages && pages.length > 0 && !pages[0].page_access_token.includes('mock'));`
);

fs.writeFileSync('src/components/FacebookConnectModal.tsx', code);
