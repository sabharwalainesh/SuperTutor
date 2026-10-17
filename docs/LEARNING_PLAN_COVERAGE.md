# Learning Coach plan coverage in SuperTutor

The supplied base plan's student experience is implemented in the **website** alongside Canvas and the existing assignment editor. Per the user's explicit direction, **Superhuman Go performs every AI task; this application has no model API key or model client**. The earlier direct-model architecture in the attached document is not used.

| Base requirement | Implementation |
| --- | --- |
| Paste text, no file upload required | Study & practice accepts 40–8,000 characters of course notes. |
| Summary, concepts, ≥3 practice questions | Go reads `get_study_session`, then writes 3–5 summary bullets, concepts, and 3–8 questions using `record_study_lesson`. The requested count and unique IDs are validated. |
| Answer and receive score, explanation, improved answer | The website saves an answer, then the student asks Go to review it. Go writes `record_practice_feedback` with the current answer revision. The website displays the result automatically. |
| Question list and answered states | Numbered question navigation, answered indicators, one answer form at a time, review count, and next/previous controls. |
| Weak-topic list from actual feedback | Aggregates missedTopics from Go-saved feedback. No fixture grades or heuristic scoring. |
| Persistence across refresh | Owner-scoped sessions persist in the same authoritative store as assignments. Unsubmitted drafts also recover from browser storage. Existing version-3 data remains compatible. |
| Loading, errors, empty, long text | Visible save/loading states, readable API errors, empty feedback/source states, source excerpts scroll, bounded inputs. No indefinite pretend-generation spinner while Go is not running. |
| Runtime response validation | Shared Zod schemas validate inputs, lessons, and feedback. Stale sessions and stale answer revisions are rejected. |
| API health | `/api/health` reports `mode: go-tools` and `modelCalls: false`. |
| Demo source | “Try sample notes” explicitly loads an example lesson. `node --import tsx scripts/demo-seed.ts` prints the demo source. Feedback still comes from Go. |
| Canvas / bCourses | Permanent navigation item, dashboard import action, course selection and assignment import. |
| Less text, motion, basic site features | Visual landing page, interactive coding/math/writing previews, animated underline and tutor hint, Canvas connection animation, FAQ accordion, sign-in dialog, password visibility, search, subject filters, sorting, theme preference, responsive navigation, browser setup guide, reduced-motion support. |

## Go setup

Run `npm install`, copy `.env.example` to `.env`, and run `npm run dev`. Open `http://localhost:5173`. No model key is required.

Publish the SuperTutor connector and agent once using [Go setup](GO_SETUP.md), set the connector listing URL for the deployment, and install the connector with a student-specific access token. The MCP server now exposes nine tools, including three study tools. Publish the updated agent instructions and reinstall/update an installed copy as needed to receive new tool grants.

For a lesson: paste notes → Prepare lesson in Go → Copy request → open your SuperTutor agent and paste → return to see the saved lesson. For review: write answer → Send answer to Go → copy/paste review request → feedback appears after Go records it.

## Verification and limits

API/store and MCP integration tests cover the study workflow, session persistence, ownership isolation, duplicate-count prevention, and stale-answer rejection. Existing Canvas tests cover connect, import, and disconnect. Browser validation uses an isolated test account and explicit simulated Go writes; this proves the app/connector protocol, not a live Superhuman installation.

A real Go account/connector interaction has now passed: the production workspace supplied course notes, Go generated and saved five questions with three summary bullets, and Go graded two submitted practice answers (100/100 and 10/100), with weak topics and improved answers visible in the website after refresh. Two independent human demo rehearsals remain external checks. School OAuth sign-in remains disabled until institution-issued credentials are configured. Proactive while-writing review still needs the intended tutoring agent installed and configured. The plan's direct-model eight-second target does not apply to a student-triggered Go conversation; the website shows a saved/handoff state and refreshes Go-authored results every three seconds while visible.
