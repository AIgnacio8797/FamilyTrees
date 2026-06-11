// Confirm and sanitize input data for tree create/update.
//
// Enforces the payload contract the frontend actually sends:
//   { version: <number>, tree: { nodes: [...], edges: [...] }, viewport: {x,y,zoom} | null }
// Returns either { error } or { cleanTitle, tree_data }.

const MAX_TITLE_LENGTH = 200;
const MAX_NODES = 5000;
const MAX_EDGES = 10000;

const isPlainObject = (value) => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const validateAndSanitizeInput = (title, tree_data) => {
    // --- title ---
    if (typeof title !== 'string') {
        return { error: 'Title must be a string' };
    }

    const cleanTitle = title.trim();

    if (cleanTitle === '') {
        return { error: 'Title is required' };
    }

    if (cleanTitle.length > MAX_TITLE_LENGTH) {
        return { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` };
    }

    // --- tree_data shape ---
    if (!isPlainObject(tree_data)) {
        return { error: 'tree_data must be an object' };
    }

    if (typeof tree_data.version !== 'number') {
        return { error: 'tree_data.version must be a number' };
    }

    const { tree, viewport } = tree_data;

    if (!isPlainObject(tree)) {
        return { error: 'tree_data.tree must be an object' };
    }

    if (!Array.isArray(tree.nodes) || !Array.isArray(tree.edges)) {
        return { error: 'tree_data.tree.nodes and tree_data.tree.edges must be arrays' };
    }

    if (tree.nodes.length > MAX_NODES) {
        return { error: `Too many nodes (max ${MAX_NODES})` };
    }

    if (tree.edges.length > MAX_EDGES) {
        return { error: `Too many edges (max ${MAX_EDGES})` };
    }

    // --- viewport: optional; may be null or an object with numeric x/y/zoom ---
    if (viewport !== undefined && viewport !== null) {
        if (!isPlainObject(viewport)) {
            return { error: 'tree_data.viewport must be an object or null' };
        }

        const { x, y, zoom } = viewport;

        if (![x, y, zoom].every((n) => typeof n === 'number' && Number.isFinite(n))) {
            return { error: 'tree_data.viewport must have numeric x, y, and zoom' };
        }
    }

    return { cleanTitle, tree_data };
};
