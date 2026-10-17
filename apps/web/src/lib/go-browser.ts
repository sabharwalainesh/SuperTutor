/** Go currently publishes desktop Chrome and Edge extensions.
 * Sources: https://help.superhuman.com/hc/en-us/articles/46550681421965
 * This is a compatibility hint, never evidence that the extension is installed.
 */
export type GoBrowser = { name: string; supported: boolean; storeUrl?: string };
export function getGoBrowser(userAgent: string, maxTouchPoints = 0, brands?: readonly { brand: string }[], brave = false): GoBrowser {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return { name: 'Mobile browser', supported: false };
  if (/Electron|HeadlessChrome|; wv\)/i.test(userAgent)) return { name: 'Embedded browser', supported: false };
  if (brave || /OPR\/|Opera|Vivaldi|SamsungBrowser/i.test(userAgent)) return { name: 'This browser', supported: false };
  if (/Edg\//.test(userAgent) || brands?.some(({ brand }) => brand === 'Microsoft Edge')) return {
    name: 'Microsoft Edge', supported: true,
    storeUrl: 'https://microsoftedge.microsoft.com/addons/detail/superhuman-go-ai-writing/pomkljejojcgechkiimaggeocndnliol',
  };
  if (brands ? brands.some(({ brand }) => brand === 'Google Chrome') : /Chrome\//.test(userAgent)) return {
    name: 'Google Chrome', supported: true,
    storeUrl: 'https://chromewebstore.google.com/detail/superhuman-go-ai-assistan/fiicfmbdhpbnebmbofpphmalhgofdakc',
  };
  return { name: /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'This browser', supported: false };
}
