import { CanvasSignIn } from './CanvasSignIn.js';
import { useEffect, useState } from 'react';
import type { Assignment, CanvasAssignment, CanvasConnection, CanvasCourse, CourseSource, Subject } from '../../../../packages/types.js';
import { connectCanvas, disconnectCanvas, getCourseSources, importCanvasAssignment, listCanvasAssignments, listCanvasCourses } from '../lib/api.js';

const STATUS_LABEL: Record<CourseSource['status'], string> = {
  connected: 'Connected',
  available: 'Ready to connect',
  'manual-only': 'Paste it in',
  'not-implemented': 'Not built yet',
};

export const CourseSources = ({ onImported, onClose }: { onImported: (assignment: Assignment) => void; onClose: () => void }) => {
  const [sources, setSources] = useState<CourseSource[]>([]);
  const [canvas, setCanvas] = useState<CanvasConnection | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [courseId, setCourseId] = useState(0);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [subject, setSubject] = useState<Subject>('coding');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const load = async () => {
    try {
      const result = await getCourseSources();
      setSources(result.sources);
      setCanvas(result.canvas);
      if (result.canvas) setBaseUrl(result.canvas.baseUrl);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not read your course sources.'); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!canvas) { setCourses([]); setCourseId(0); setAssignments([]); return; }
    let canceled = false;
    setBusy(true);
    listCanvasCourses()
      .then(({ courses: items }) => { if (!canceled) { setCourses(items); setCourseId(items[0]?.id ?? 0); } })
      .catch((problem) => { if (!canceled) setError(problem instanceof Error ? problem.message : 'Canvas did not return your courses.'); })
      .finally(() => { if (!canceled) setBusy(false); });
    return () => { canceled = true; };
  }, [canvas]);
  useEffect(() => {
    if (!courseId) { setAssignments([]); return; }
    let canceled = false;
    setAssignments([]); setError(''); setBusy(true);
    listCanvasAssignments(courseId)
      .then(({ assignments: items }) => { if (!canceled) setAssignments(items); })
      .catch((problem) => { if (!canceled) setError(problem instanceof Error ? problem.message : 'Canvas did not return that course\'s assignments.'); })
      .finally(() => { if (!canceled) setBusy(false); });
    return () => { canceled = true; };
  }, [courseId]);

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setStatus('');
    try {
      setCanvas(await connectCanvas({ baseUrl, token }));
      setToken('');
      setStatus('Canvas connected.');
      await load();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not connect Canvas.'); }
    finally { setBusy(false); }
  };
  const disconnect = async () => {
    setBusy(true); setError('');
    try { await disconnectCanvas(); setCanvas(null); setToken(''); setStatus('Canvas disconnected and the token deleted.'); await load(); }
    catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not disconnect Canvas.'); }
    finally { setBusy(false); }
  };
  const importOne = async (assignment: CanvasAssignment) => {
    setBusy(true); setError(''); setStatus('');
    try {
      const created = await importCanvasAssignment({ courseId, assignmentId: assignment.id, subject });
      setStatus(`Imported "${created.title}". Write your attempt in the workspace.`);
      onImported(created);
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not import that assignment.'); }
    finally { setBusy(false); }
  };

  return <section className="pane brief">
    <header className="pane-head">
      <h2>Canvas & bCourses</h2>
      <button className="link" onClick={onClose}>Back to my work</button>
    </header>
    <div className="content">
      <p className="prompt">Your courses and assignments, one import away.</p>
      {error && <p className="banner error" role="alert">{error}</p>}
      {status && <p className="save-state" role="status">{status}</p>}

      <div className="canvas-connection-heading"><span className="canvas-mini">C</span><div><h3>Canvas / bCourses</h3><p className="muted">Bring your course into your workspace.</p></div></div>
      {canvas
        ? <>
          <ul className="token-list">
            <li>
              <span>
                <strong>{canvas.userName ?? 'Connected'}</strong>
                <span className="token-meta"> {new URL(canvas.baseUrl).hostname} · {canvas.lastUsedAt ? `last read ${new Date(canvas.lastUsedAt).toLocaleString()}` : 'not read yet'}</span>
              </span>
              <button className="link" disabled={busy} onClick={() => void disconnect()}>Disconnect and delete token</button>
            </li>
          </ul>
          <label>Course
            <select value={courseId} disabled={busy || !courses.length} onChange={(event) => setCourseId(Number(event.target.value))}>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.courseCode ? `${course.courseCode} — ` : ''}{course.name}</option>)}
            </select>
          </label>
          <label>Import as
            <select value={subject} disabled={busy} onChange={(event) => setSubject(event.target.value as Subject)}>
              <option value="coding">Coding</option><option value="math">Math</option><option value="writing">Writing</option>
            </select>
          </label>
          {assignments.length === 0 && !busy && <p className="empty">Canvas listed no assignments for this course.</p>}
          <ul className="token-list">
            {assignments.map((assignment) => <li key={assignment.id}>
              <span>
                <strong>{assignment.name}</strong>
                <span className="token-meta"> {assignment.dueAt ? `due ${new Date(assignment.dueAt).toLocaleDateString()}` : 'no due date'}{assignment.pointsPossible === null ? '' : ` · ${assignment.pointsPossible} points`}</span>
              </span>
              <button disabled={busy} onClick={() => void importOne(assignment)}>Import</button>
            </li>)}
          </ul>
          <p className="fineprint">Importing copies the instructions, due date, and Canvas link. It never reads your grades or submits anything to Canvas.</p>
        </>
        : <><CanvasSignIn intent="connect"/><details><summary>Connect manually with an access token</summary><form onSubmit={connect}>
          <details><summary>Where do I find my Canvas access token?</summary><p>In Canvas, open <strong>Account → Settings → New access token</strong>. Copy it and paste it below.</p></details>
          <label>Canvas web address<input required value={baseUrl} maxLength={255} placeholder="canvas.instructure.com" onChange={(event) => setBaseUrl(event.target.value)} /></label>
          <label>Access token<input required type="password" value={token} maxLength={500} autoComplete="off" onChange={(event) => setToken(event.target.value)} /></label>
          <div className="actions">
            <button className="primary" disabled={busy || !baseUrl.trim() || token.trim().length < 20}>{busy ? 'Checking with Canvas…' : 'Connect Canvas'}</button>
          </div>
          <p className="fineprint">Stored on this server for imports. Deleted when you disconnect.</p>
        </form></details></>}

      <details className="other-sources"><summary>Other course material</summary>
      <ul className="topic-list">
        {sources.filter((source) => source.id !== 'canvas').map((source) => <li key={source.id} style={{ display: 'block' }}>
          <div className="note-head">
            <strong>{source.name}</strong>
            <span className="chip">{STATUS_LABEL[source.status]}</span>
          </div>
          <p className="fineprint">{source.detail}</p>
        </li>)}
      </ul></details>
    </div>
  </section>;
};
