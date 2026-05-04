const fs = require('fs');
const layoutPath = 'd:/Project APP/AntiGravity/neo_line_oa/src/app/(dashboard)/layout.tsx';
let content = fs.readFileSync(layoutPath, 'utf8');

// 1. Add TopBar import
content = content.replace(
  "import { TopBarClock } from '@/components/layout/TopBarClock';",
  "import { TopBar } from '@/components/layout/TopBar';\nimport { TopBarClock } from '@/components/layout/TopBarClock';"
);

// 2. Remove contexts and states
const contextBlock = `  const {
    notifications,
    unreadCount,
    markAllRead,
    markAsRead,
    isMuted,
    toggleMute,
  } = useNotificationContext();`;
content = content.replace(contextBlock, '');

const stateBlock1 = `  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem('theme') || 'light';
  });

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);`;
content = content.replace(stateBlock1, '');

// Remove useEffect
const effectStart = content.indexOf('  useEffect(() => {\n    function handleClick(event: MouseEvent) {');
if (effectStart !== -1) {
  const effectEnd = content.indexOf('  }, []);', effectStart) + '  }, []);'.length;
  content = content.substring(0, effectStart) + content.substring(effectEnd);
}

// Remove changeTheme
const changeThemeStart = content.indexOf('  const changeTheme = (newTheme: string) => {');
if (changeThemeStart !== -1) {
  const changeThemeEnd = content.indexOf('  };', changeThemeStart) + '  };'.length;
  content = content.substring(0, changeThemeStart) + content.substring(changeThemeEnd);
}

// Remove handleLogout
const logoutStart = content.indexOf('  const handleLogout = async () => {');
if (logoutStart !== -1) {
  const logoutEnd = content.indexOf('  };', logoutStart) + '  };'.length;
  content = content.substring(0, logoutStart) + content.substring(logoutEnd);
}

// Remove handleNotifClick
const notifClickStart = content.indexOf('  const handleNotifClick = (notif: AppNotification) => {');
if (notifClickStart !== -1) {
  const notifClickEnd = content.indexOf('  };', notifClickStart) + '  };'.length;
  content = content.substring(0, notifClickStart) + content.substring(notifClickEnd);
}

// Remove filteredNotifs
const filteredStart = content.indexOf('  const filteredNotifs = notifications.filter((notif) => {');
if (filteredStart !== -1) {
  const filteredEnd = content.indexOf('  });', filteredStart) + '  });'.length;
  content = content.substring(0, filteredStart) + content.substring(filteredEnd);
}

// Replace header with TopBar
const headerStart = content.indexOf('<header className="top-bar">');
const headerEnd = content.indexOf('</header>', headerStart) + '</header>'.length;
content = content.substring(0, headerStart) + '<TopBar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isSidebarCollapsed={isSidebarCollapsed} setIsSidebarCollapsed={setIsSidebarCollapsed} />' + content.substring(headerEnd);

fs.writeFileSync(layoutPath, content);
console.log('Done refactoring layout.tsx!');
