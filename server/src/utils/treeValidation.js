// confirm and sanitize input data

export const validateAndSanitizeInput = (title, tree_data) => {
    const cleanTitle = typeof title === 'string' ? title.trim() : '';

    if (cleanTitle === '' || tree_data === undefined) {
        return { error: 'Missing title or tree_data in request body' };
    }

    return {
        cleanTitle,
        tree_data,
    };
};
