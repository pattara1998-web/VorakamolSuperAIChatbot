const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const importHandlerCode = `
  const handleImportPages = async (newPages: PageConfig[]) => {
    setPages(newPages);
    if (newPages.length > 0) {
      setSelectedPageId(newPages[0].page_id);
      try {
        await fetch('/api/data/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collection: 'pages', data: newPages })
        });
      } catch (err) {
        console.error('Failed to sync pages to server:', err);
      }
    }
  };
`;

code = code.replace(
  /const \[theme, setTheme\] = useState\<'dark' \| 'light'\>\('light'\);/,
  `const [theme, setTheme] = useState<'dark' | 'light'>('light');\n\n${importHandlerCode}`
);

code = code.replace(
  /selectedPageId={selectedPageId}/g,
  `selectedPageId={selectedPageId}\n        onImportPages={handleImportPages}`
);

fs.writeFileSync('src/App.tsx', code);
