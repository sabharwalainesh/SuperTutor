import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Bundle Monaco with the app instead of fetching it from a CDN, so the page keeps a
// script-src 'self' policy and the workspace still works offline.
self.MonacoEnvironment = {
  getWorker(_id, label) {
    return label === 'typescript' || label === 'javascript' ? new tsWorker() : new editorWorker();
  },
};

// The editor sits inside a sheet of the pad, so it is themed to the pad rather than shipped
// as a foreign dark rectangle. Both themes share the ink palette in styles.css.
monaco.editor.defineTheme('supertutor-paper', {
  base: 'vs', inherit: true,
  rules: [
    { token: '', foreground: '1b2430' },
    { token: 'comment', foreground: '8b95a1', fontStyle: 'italic' },
    { token: 'keyword', foreground: '1b4f8a' },
    { token: 'string', foreground: '1f6a4d' },
    { token: 'number', foreground: 'b23a23' },
    { token: 'type', foreground: '1b4f8a' },
    { token: 'function', foreground: '1b2430' },
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1b2430',
    'editorLineNumber.foreground': '#b2bcc5',
    'editorLineNumber.activeForeground': '#55616f',
    'editor.selectionBackground': '#dde6f2',
    'editor.lineHighlightBackground': '#f2f4f1',
    'editorIndentGuide.background1': '#e4e9e4',
    'editorCursor.foreground': '#b23a23',
    'editorWidget.background': '#f2f4f1',
    'editorWidget.border': '#c8d0c9',
  },
});
monaco.editor.defineTheme('supertutor-blueprint', {
  base: 'vs-dark', inherit: true,
  rules: [
    { token: '', foreground: 'e6eef2' },
    { token: 'comment', foreground: '6f8798', fontStyle: 'italic' },
    { token: 'keyword', foreground: '8fc3f5' },
    { token: 'string', foreground: '6cc49d' },
    { token: 'number', foreground: 'ef8f74' },
    { token: 'type', foreground: '8fc3f5' },
    { token: 'function', foreground: 'e6eef2' },
  ],
  colors: {
    'editor.background': '#182a25',
    'editor.foreground': '#e6eef2',
    'editorLineNumber.foreground': '#4a6577',
    'editorLineNumber.activeForeground': '#a8bcc9',
    'editor.selectionBackground': '#24455e',
    'editor.lineHighlightBackground': '#1b3028',
    'editorIndentGuide.background1': '#1c3647',
    'editorCursor.foreground': '#ef8f74',
    'editorWidget.background': '#0d1a26',
    'editorWidget.border': '#2a4a60',
  },
});
loader.config({ monaco });

/** Follows the pad: paper by day, blueprint at night. */
export const editorTheme = () => document.documentElement.dataset.theme === 'dark' ? 'supertutor-blueprint' : 'supertutor-paper';

export const CODE_LANGUAGES = ['python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'sql', 'plaintext'] as const;
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
export const EDITOR_OPTIONS = {
  minimap: { enabled: false },
  wordWrap: 'on',
  fontSize: 13,
  fontFamily: "'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace",
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  renderWhitespace: 'selection',
  padding: { top: 14, bottom: 14 },
  // The tutor should see the student's own thinking, not an autocompleted answer.
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  parameterHints: { enabled: false },
} as const;
