# FamilyTrees

`FamilyTrees` is a browser-based family tree editor built with React, Vite, and React Flow.

This introduction is a placeholder for the final product description. The goal of the app is to let users build, edit, and eventually share family trees through a clean visual canvas with simple controls for managing people, relationships, and layouts.

## Current Features

- Add, delete, and reposition people on the canvas
- Quick-add relatives from a selected person:
  - parent
  - child
  - sibling
- Direct line-based relationships without separate visible relationship nodes
- Edit node colors with a color picker
- Edit line colors and line styles
- Shift-click and lasso selection for multiple people and lines
- Bulk line editing for selected relationships
- Undo and redo with controller buttons and keyboard shortcuts
- Right-side controller for edit, view, and export/import modes

## Tech Stack

- React
- Vite
- React Flow (`@xyflow/react`)
- Font Awesome

## File Layout

```text
FamilyTrees/
|-- public/
|   |-- favicon.svg
|   `-- icons.svg
|-- src/
|   |-- assets/
|   |   |-- hero.png
|   |   |-- react.svg
|   |   `-- vite.svg
|   |-- components/
|   |   |-- PersonNode.jsx
|   |   |-- RelationshipEdge.jsx
|   |   |-- RelationshipNode.jsx
|   |   `-- RelationshipPanel.jsx
|   |-- constants/
|   |   |-- familyTree.js
|   |   `-- lineStyles.js
|   |-- App.css
|   |-- App.jsx
|   |-- index.css
|   `-- main.jsx
|-- index.html
|-- package.json
|-- package-lock.json
|-- vite.config.js
`-- eslint.config.js
```

## Key Files

- `src/App.jsx`  
  Main canvas logic, controller state, selection behavior, and undo/redo history.

- `src/components/PersonNode.jsx`  
  Custom person node rendering and connection handles.

- `src/components/RelationshipEdge.jsx`  
  Custom relationship line rendering, selected-line highlighting, and edge visuals.

- `src/constants/familyTree.js`  
  Starter tree data and default graph setup.

- `src/constants/lineStyles.js`  
  Shared line style definitions used by relationship edges.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run lint
npm run preview
```

## Notes

- The app is currently focused on editing and interaction.
- Future work may include save/load, export/import, smarter layouts, and a polished read-only viewing mode.
