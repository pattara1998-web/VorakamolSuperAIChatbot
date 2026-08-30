const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/selectedPageId={selectedPageId}\n        onImportPages={handleImportPages}/g, 'selectedPageId={selectedPageId}');

code = code.replace(
  /<FacebookConnectModal\s+isOpen=\{true\}\s+onClose=\{\(\) => setActiveTab\('pages_hub'\)\}\s+pages=\{pages\}\s+selectedPageId=\{selectedPageId\}\s*\/>/g,
  `<FacebookConnectModal
              isOpen={true}
              onClose={() => setActiveTab('pages_hub')}
              pages={pages}
              selectedPageId={selectedPageId}
              onImportPages={handleImportPages}
            />`
);

code = code.replace(
  /<FacebookConnectModal\s+isOpen=\{isConnectModalOpen\}\s+onClose=\{\(\) => setIsConnectModalOpen\(false\)\}\s+pages=\{pages\}\s+selectedPageId=\{selectedPageId\}\s*\/>/g,
  `<FacebookConnectModal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        pages={pages}
        selectedPageId={selectedPageId}
        onImportPages={handleImportPages}
      />`
);

fs.writeFileSync('src/App.tsx', code);
