# Canvas sign-in across schools

The website offers a school chooser with UC Berkeley / bCourses, Stanford, UCLA / Bruin Learn, configured institutions, and another-school address entry. A school is enabled only when this deployment has its approved Canvas OAuth registration. Canvas credentials are entered on the school's website, never into SuperTutor.

Successful authorization creates or signs into the student's SuperTutor account and saves their Canvas connection automatically. Existing students can instead choose **Connect with your school** under **Canvas & bCourses** to explicitly link their current account. Identity is the Canvas origin plus Canvas user ID; matching email addresses do not merge accounts.

## Enable a school

An institution's Canvas administrator must issue and enable an OAuth developer key for this app. Keys are school-specific; knowing a school's Canvas URL does not grant API access. See the official [developer key requirements](https://developerdocs.instructure.com/services/canvas/oauth2/file.developer_keys) and [OAuth endpoints](https://developerdocs.instructure.com/services/canvas/oauth2/file.oauth_endpoints).

1. Register the exact callback URL: `https://YOUR_SUPERTUTOR_ORIGIN/api/auth/canvas/callback`. Local development uses `http://localhost:5173/api/auth/canvas/callback` through Vite's proxy.
2. Enable these read-only scopes on the key:
   - `url:GET|/api/v1/users/:id`
   - `url:GET|/api/v1/courses`
   - `url:GET|/api/v1/courses/:course_id/assignments`
3. Set `CANVAS_OAUTH_INSTITUTIONS` in the server environment to a JSON array, with one object per institution. Keep secrets out of source control and chat:

```json
[
  {
    "id": "berkeley",
    "name": "UC Berkeley / bCourses",
    "baseUrl": "https://bcourses.berkeley.edu",
    "clientId": "INSTITUTION_ISSUED_CLIENT_ID",
    "clientSecret": "INSTITUTION_ISSUED_SECRET",
    "redirectUri": "http://localhost:5173/api/auth/canvas/callback"
  },
  {
    "id": "another-school",
    "name": "Another University",
    "baseUrl": "https://canvas.yourschool.edu",
    "clientId": "THAT_SCHOOLS_CLIENT_ID",
    "clientSecret": "THAT_SCHOOLS_SECRET",
    "redirectUri": "http://localhost:5173/api/auth/canvas/callback"
  }
]
```

4. Restart the server. Only configured schools become enabled in the chooser. Each ID and Canvas origin must be unique; callback URLs must use HTTPS outside localhost development. No model API key is involved.
5. Test using a real school account: authorize, confirm the workspace opens **Canvas & bCourses** with the connected student's name, list a course, and import an assignment. Local tests use an isolated OAuth provider and cannot establish institution approval.

## Connection behavior

OAuth state and a browser-bound HttpOnly nonce expire after ten minutes and are consumed once. The server exchanges the authorization code and stores access/refresh tokens in the private state file; neither tokens nor client secrets appear in browser API responses. Import requests refresh expiring OAuth credentials automatically. Disconnecting deletes both access and refresh credentials locally. Revoke the app in Canvas as well to remove the institution-side grant.

Canceling authorization returns to sign-in with an explanatory error. Unknown or unconfigured schools cannot begin authorization. Email sign-in plus manual Canvas access-token connection remains available for schools without an approved OAuth registration.
