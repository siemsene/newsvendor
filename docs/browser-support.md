# Browser Support

This project targets current desktop-class Chromium and Firefox with laptops and tablets as the primary layout focus.

## Supported Baseline

- Chromium: current stable desktop releases
- Firefox: current stable desktop releases
- Viewports validated during compatibility checks:
  - `1366x900`
  - `1024x768`
  - `820x1180`

Phones are not a primary optimization target in this round, but they should continue to benefit from the same responsive CSS improvements.

## Compatibility Workflow

1. Build the app:
   `npm run build`
2. Run the browser smoke check:
   `npm run test:compat`

The smoke check verifies:

- Chromium and Firefox can render the public shell routes
- The app still boots when `localStorage` is unavailable
- Theme toggle still works when storage is available
- Tested routes do not introduce uncontrolled horizontal overflow

## Manual Follow-Up

Run additional manual checks with representative data for authenticated routes:

- `/host`
- `/host/session/:sessionId`
- `/play/:sessionId`
- `/admin/instructors/:uid`

Focus on:

- dense day-card layouts
- tables and scroll containers
- focus states and dialogs
- chart readability on portrait tablets
