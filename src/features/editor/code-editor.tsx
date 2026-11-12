'use client';

import dynamic from 'next/dynamic';
import { loader } from '@monaco-editor/react';
import { useAppStore } from '@/stores/use-app-store';

loader.config({ paths: { vs: '/monaco/vs' } });
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string | number;
  readOnly?: boolean;
  modelPath?: string;
}

export function CodeEditor({ value, onChange, language = 'csharp', height = '100%', readOnly = false, modelPath }: CodeEditorProps) {
  const theme = useAppStore((s) => s.theme);
  return <div dir="ltr" style={{ height, minHeight: 180, width: '100%' }} data-testid="code-editor">
    <Editor height="100%" path={modelPath} language={language} value={value} onChange={(next) => onChange(next ?? '')}
      theme={theme === 'light' ? 'vs' : 'bitro-dark'}
      loading={<div style={{ padding: 28, color: 'var(--muted)', fontFamily: 'monospace' }}>Loading editor…</div>}
      beforeMount={(monaco) => monaco.editor.defineTheme('bitro-dark', { base: 'vs-dark', inherit: true,
        rules: [{ token: 'comment', foreground: '68728d', fontStyle: 'italic' }, { token: 'keyword', foreground: 'c2a2ff' }, { token: 'string', foreground: '9ed4a5' }, { token: 'number', foreground: 'f0ba82' }, { token: 'type', foreground: '7ddbd9' }],
        colors: { 'editor.background': '#121520', 'editor.foreground': '#d9dfee', 'editorLineNumber.foreground': '#525c76', 'editor.lineHighlightBackground': '#1d2132', 'editor.selectionBackground': '#6352a955', 'editorCursor.foreground': '#a78bfa', 'editorIndentGuide.background1': '#252b3d', 'editorWidget.background': '#191d2c' } })}
      options={{ readOnly, fontFamily: '"JetBrains Mono", monospace', fontSize: 13, lineHeight: 24, minimap: { enabled: false }, padding: { top: 22, bottom: 20 }, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 4, lineNumbersMinChars: 3, wordWrap: 'on', bracketPairColorization: { enabled: true }, renderLineHighlight: 'all', smoothScrolling: true, folding: true, ariaLabel: 'ویرایشگر کد', accessibilitySupport: 'auto' }} />
  </div>;
}
