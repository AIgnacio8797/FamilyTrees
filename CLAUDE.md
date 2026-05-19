# CLAUDE.md

This file is for Claude Code or any future AI/code assistant working in this repository.

Project: `FamilyTrees`
Status date: 2026-05-19


## Project Summary

FamilyTrees is a browser-based family tree editor built with:

- React
- Vite
- React Flow
- Font Awesome
- Express
- PostgreSQL

The app already supports:

- freeform tree editing
- person nodes
- relationship lines
- node and line styling
- lasso and multi-select
- undo/redo
- local draft autosave
- JSON import/export
- backend save/update through PostgreSQL
- top-center editable tree title
- controller-based editing UI

The project is now past the “starter app” phase. The next major product milestone is turning saved trees into re-openable, URL-driven records rather than just an editor that can save.


## Current Product Position

As of 2026-05-19:

- Frontend editing is functional and fairly polished
- Backend CRUD routes for trees exist and work
- Frontend can save to the backend through the UI
- Vite proxies `/api` requests to the Express server in development
- Save feedback exists through a toast in the bottom-right
- Tree title editing exists in the top-center overlay

What is still notably incomplete:

- loading a saved tree from the backend into the app flow
- route-based tree loading
- shareable links
- a fully intentional read-only visitor experience


## Repo Layout

```text
FamilyTrees/
|-- CLAUDE.md
|-- Design Map/
|-- dist/
|-- public/
|-- server/
|   |-- src/
|   |   |-- routes/
|   |   |   `-- tree.js
|   |   |-- utils/
|   |   |   `-- treeValidation.js
|   |   |-- db.js
|   |   `-- index.js
|   `-- package.json
|-- src/
|   |-- api/
|   |   `-- trees.js
|   |-- assets/
|   |   `-- hero.png
|   |-- components/
|   |   |-- PersonNode.jsx
|   |   |-- RelationshipEdge.jsx
|   |   |-- RelationshipNode.jsx
|   |   |-- RelationshipPanel.jsx
|   |   `-- TreeController.jsx
|   |-- constants/
|   |   |-- familyTree.js
|   |   `-- lineStyles.js
|   |-- utils/
|   |   `-- treeData.js
|   |-- App.jsx
|   |-- index.css
|   `-- main.jsx
|-- index.html
|-- package.json
|-- package-lock.json
|-- vite.config.js
`-- eslint.config.js
```


## Important Files

### Frontend

#### `src/App.jsx`
The main app shell. This is where most of the project state currently lives:

- tree graph state
- undo/redo history
- selection state
- autosave scheduling
- backend save flow
- title editing state
- save feedback toast state
- React Flow setup

This file is central but somewhat large. Be careful when editing it. Prefer small, scoped changes unless you are intentionally refactoring.

#### `src/components/TreeController.jsx`
The right-side controller. Handles:

- edit/view/import-export mode tabs
- people tools
- line tools
- import/export buttons
- save button

This is the main surface for app controls.

#### `src/api/trees.js`
Frontend API helper for backend tree persistence.

Current known functions:

- `createTree`
- `updateTree`
- `getTreeById` may be added or expanded depending on current branch state

If persistence work is happening, this file is usually part of it.

#### `src/utils/treeData.js`
Contains:

- export helpers
- import parsing
- local draft autosave helpers

Important because the project currently has both:

- local browser draft persistence
- backend save persistence

These are different workflows and should stay conceptually separate.

#### `src/index.css`
Global styling for:

- controller
- title editor
- save toast
- React Flow controls
- theming

The app uses a tree-inspired palette based on green, pale yellow, and brown.


### Backend

#### `server/src/index.js`
Express server bootstrap.

Should:

- load env vars
- create app
- parse JSON
- mount routes
- listen on the backend port

#### `server/src/db.js`
PostgreSQL pool setup using env vars.

#### `server/src/routes/tree.js`
Main CRUD API for tree records.

Routes:

- `GET /api/trees/:id`
- `POST /api/trees`
- `PUT /api/trees/:id`
- `DELETE /api/trees/:id`

Important rule already enforced:

- update identity comes from the URL
- top-level body `id` is rejected for updates

#### `server/src/utils/treeValidation.js`
Shared validation/sanitization helper for title and tree data.


## Data Shape

The backend stores tree payloads in a `jsonb` field called `tree_data`.

Current expected shape:

```js
{
  version: 1,
  tree: {
    nodes: [...],
    edges: [...],
  },
  viewport: {
    x,
    y,
    zoom,
  }
}
```

Top-level row shape in Postgres:

```text
id
title
tree_data
created_at
updated_at
```


## Development Workflow

### Frontend

From `FamilyTrees/`:

```bash
npm run dev
```

### Backend

From `FamilyTrees/server/`:

```bash
npm run dev
```

### Important note

The frontend and backend run separately.

- frontend: Vite dev server
- backend: Express

The frontend depends on `vite.config.js` proxying `/api` to the backend. Do not remove or casually undo that proxy unless you are replacing it with another dev strategy.


## UI/UX Conventions

### Controller

The right controller is a core piece of the app identity.

Current styling direction:

- dark green controller shell
- yellow action buttons
- light green inactive tabs
- brown-toned emphasis for active/hover states

If adjusting controller visuals:

- keep the tree-inspired palette
- keep the buttons readable
- avoid making selected and unselected states too subtle

### Title editor

The tree title is:

- fixed to the screen
- top-center
- not part of the flow canvas
- editable by double-click

Expected behavior:

- double-click enters edit mode
- input auto-focuses
- input auto-selects all text
- `Enter` saves
- blur saves
- `Escape` cancels

### Save feedback

The save interaction should feel alive.

Current pattern:

- saving spinner
- success toast
- error toast

If editing save UX, preserve visible feedback. Silent saves are discouraged.


## Architecture Notes

### Local draft vs backend save

These are not the same thing.

Local draft autosave:

- protects editing sessions in the browser
- should feel temporary and local

Backend save:

- is the durable persistence path
- should be the source of truth for saved/shareable trees

Do not collapse these concepts accidentally.

### Tree identity

The app currently uses:

- `treeId` in frontend state for backend record identity
- `treeTitle` in frontend state for display and persistence

That identity needs to become part of load/reopen/share workflows.


## Things Already Solved

These do not need to be reinvented:

- PostgreSQL connection
- CRUD API routes
- frontend save to backend
- Vite proxy for `/api`
- JSON export/import
- autosave local draft
- title editor overlay
- save feedback toast


## Highest-Priority Next Work

If starting a new work session, focus here first:

### 1. Load a saved tree by id

Needed outcome:

- fetch saved tree row from backend
- restore:
  - `tree`
  - `treeTitle`
  - `treeId`
  - `viewport`

This is the most important next functional milestone.

### 2. Route-based tree loading

Needed outcome:

- tree id can come from the URL
- opening a saved link restores the correct tree

This is the bridge to shareable links.

### 3. Visitor/read-only experience

Needed outcome:

- a saved tree can be viewed cleanly without editor-heavy UI
- view mode should feel intentional, not just “edit mode with things hidden”


## Lower-Priority Work

Do later, not first:

- auth
- permissions
- multi-user editing
- deployment infrastructure
- major schema expansion
- big component refactors unless blocked


## Editing Guidance

- Prefer small, readable changes.
- Preserve current data format unless intentionally versioning it.
- When changing persistence behavior, check both:
  - local draft flow
  - backend save flow
- When changing UI, keep the current visual language coherent across:
  - controller
  - title editor
  - save toast
  - React Flow controls


## Notes For Future Agents

- The repo has already had starter Vite leftovers cleaned out.
- `dist/` is intentionally retained.
- The README has been updated to match the real app structure.
- Planning docs in `Design Map/` are internal notes and should stay out of normal product-facing flows.


## Recommended First Question In A New Session

If the user says “what should we work on next?”, the best current answer is:

“Let’s finish the saved-tree lifecycle by loading trees from the backend by id, then wire that into route-based URLs so shareable links can begin.”
