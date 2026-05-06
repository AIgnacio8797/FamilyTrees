# FamilyTrees

FamilyTrees is a browser-based family tree editor built with React, Vite, React Flow, and a small Express/PostgreSQL backend for persistence.

## What It Does

- Create and edit people on a freeform family tree canvas
- Connect people with relationship lines
- Quick-add relatives from a selected person:
  - parent
  - child
  - sibling
- Edit node colors
- Edit relationship line colors and line styles
- Select with shift-click and lasso tools
- Bulk edit selected relationship lines
- Undo and redo with buttons and keyboard shortcuts
- Edit the tree title directly from the top-center title field
- Save trees to PostgreSQL through the app UI
- Export the current tree as JSON
- Import a previously exported tree file
- Autosave a local draft in the browser

## Stack

### Frontend
- React
- Vite
- React Flow (`@xyflow/react`)
- Font Awesome

### Backend
- Express
- PostgreSQL
- `pg`

## Project Structure

```text
FamilyTrees/
|-- Design Map/
|-- dist/
|-- public/
|   |-- favicon.svg
|   `-- icons.svg
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

## Key Frontend Files

- `src/App.jsx`  
  Main app shell, tree state, save flow, title editing, autosave, selection logic, and React Flow setup.

- `src/components/TreeController.jsx`  
  Right-side controller UI for editing, view mode, import/export, and save actions.

- `src/components/PersonNode.jsx`  
  Custom person node rendering and inline label editing behavior.

- `src/components/RelationshipEdge.jsx`  
  Custom relationship edge styling and selection visuals.

- `src/utils/treeData.js`  
  Import/export helpers, local draft persistence, and tree parsing utilities.

## Key Backend Files

- `server/src/index.js`  
  Express app setup and route mounting.

- `server/src/db.js`  
  PostgreSQL pool configuration.

- `server/src/routes/tree.js`  
  CRUD routes for saving, loading, updating, and deleting trees.

- `server/src/utils/treeValidation.js`  
  Shared tree input sanitizing and validation logic.

## Running The Project

### Frontend

```bash
npm install
npm run dev
```

### Backend

From the `server/` folder:

```bash
npm install
npm run dev
```

The frontend runs through Vite, and the backend runs separately through Express. Vite proxies `/api` requests to the backend during development.

## Build

```bash
npm run build
```

## Notes

- `dist/` is retained as build output.
- Tree saves use PostgreSQL persistence through the backend.
- JSON export/import is still available as a separate file-based workflow.
