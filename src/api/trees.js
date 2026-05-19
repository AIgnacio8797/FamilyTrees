//frontend talks to the backend for CRUD operations on tree data

const createTree = async (title, treeData) => {
    const response = await fetch('/api/trees', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, tree_data: treeData}),
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status: ${response.status}`);
    }
    
    return await response.json();
}

const updateTree = async (treeId, title, treeData) => {
    const response = await fetch(`/api/trees/${treeId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, tree_data: treeData}),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed with status: ${response.status}`);
    }

    return await response.json();
}

const getTreeById = async (TreeId) => {
    const response = await fetch(`/api/tress/${treeId}`);

    if(!response.ok) {
        const errorData = await response.json()
        throw new err
    }

    return await response.json();
}

export default { createTree, updateTree, getTreeById };