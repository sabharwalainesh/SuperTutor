const paths = {
  arrow: 'M5 12h14m-6-6 6 6-6 6', plus: 'M12 5v14M5 12h14',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  book: 'M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v15',
  spark: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  code: 'm8 5-7 7 7 7m8-14 7 7-7 7m-3-17-2 20',
  math: 'M4 5h16M4 12h16M4 19h16m-4-3 4 3-4 3',
  pen: 'm15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14Z',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
  moon: 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10',
  close: 'm6 6 12 12M6 18 18 6', check: 'm5 12 4 4L19 6',
  logout: 'M9 4H4v16h5m5-12 4 4-4 4m-7-4h11',
  help: 'M9 8a3 3 0 1 1 4 3c-1 1-1 1-1 3m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
} as const;
export type IconName = keyof typeof paths;
export const Icon = ({name, size = 20}: {name: IconName; size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
export const Logo = () => <span className="brand"><span className="brand-symbol"><Icon name="spark" size={23}/></span><span>SuperTutor<span className="brand-dot">.</span></span></span>;
