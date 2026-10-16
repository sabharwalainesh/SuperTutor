import { useState } from 'react';
export const GoGuide = ({ title, id }: { title: string; id: string }) => {
  const [copied, setCopied] = useState(false);
  const prompt = `Use SuperTutor to open assignment ${id} (${title}). Read my saved work and course context. Help me understand where I am stuck, one question or hint at a time. Do not give the finished homework solution. Record my actual attempt and your feedback in the workspace.`;
  return <section className="pane go-guide"><div className="content">
    <span className="eyebrow">Your tutor lives in Superhuman Go</span><h2>Save your work. Then ask for a hint.</h2>
    <p>After the SuperTutor connector and agent are configured, open Go and select SuperTutor. This workspace will show the feedback it saves.</p>
    <div className="actions"><a className="button primary" href="https://go.superhuman.com/" target="_blank" rel="noreferrer">Open Superhuman Go ↗</a>
      <button onClick={async () => { try { await navigator.clipboard.writeText(prompt); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy starter prompt'}</button></div>
    <details><summary>Show starter prompt</summary><p className="starter">{prompt}</p></details>
    <p className="fineprint">Before your first session, configure the SuperTutor connector and select the SuperTutor agent in Go.</p>
  </div></section>;
};
