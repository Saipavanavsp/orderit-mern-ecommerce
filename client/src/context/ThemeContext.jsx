import { useEffect, useState } from 'react';
import { ThemeContext } from './contexts.js';


function initialTheme() {
  try {
    return localStorage.getItem('oi-theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('oi-theme', theme);
    } catch {
      // storage unavailable (private mode) - theme still applies for this session
    }
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }}>
      {children}
    </ThemeContext.Provider>
  );
}
