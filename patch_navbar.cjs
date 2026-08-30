const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

code = code.replace(
  /const navItems = \[[\s\S]*?\];/,
  `const isConnected = pages && pages.length > 0 && !pages[0].page_access_token.includes('mock');
  
  const navItems = [
    { id: 'pages_hub', label: 'ศูนย์รวมเพจ (Pages Hub)', icon: Layers },
    { id: 'dashboard', label: 'แดชบอร์ด & ยอดขาย', icon: LayoutDashboard },
    { id: 'orders', label: 'ออเดอร์ & ขนส่ง (COD)', icon: ShoppingBag },
    { id: 'crm', label: 'ฐานข้อมูลลูกค้า CRM', icon: Users },
    { id: 'comments', label: 'จัดการคอมเมนต์ & โพสต์', icon: MessageCircle },
    { id: 'followup', label: 'ระบบตามติด (Follow-up)', icon: BellRing },
    { id: 'database', label: 'แก้ไขฐานข้อมูล (Database)', icon: Database },
    ...(isConnected ? [] : [{ id: 'simulator', label: 'จำลองแชท AI ปิดการขาย', icon: MessageSquare }])
  ];`
);

fs.writeFileSync('src/components/Navbar.tsx', code);
