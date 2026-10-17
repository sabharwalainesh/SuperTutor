import { useEffect, useState } from 'react';
import { Icon } from './Icons.js';
export function ThemeToggle() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('supertutor.theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('supertutor.theme', theme); } catch { /* Preference only. */ }
    window.dispatchEvent(new Event('supertutor-theme'));
  }, [theme]);
  return <button className="icon-button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}><Icon name={theme === 'light' ? 'moon' : 'sun'}/></button>;
}
