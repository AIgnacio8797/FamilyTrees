// CRUD for the family tree data
import { Router } from 'express';
import pool from '../db.js';
import { validateAndSanitizeInput } from '../utils/treeValidation.js';
import { requireAuth } from '../middleware/requireAuth.js';


const router = Router();

// Get tree by ID — public (anyone with the link can view).
// Includes isOwner so the frontend can choose edit vs. view mode.
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const results = await pool.query(`SELECT * FROM trees WHERE id = $1`, [id]);

        if (results.rows.length === 0) {
            return res.status(404).json({ error: 'Tree not found' });
        }

        const tree = results.rows[0];
        const isOwner = Boolean(req.user && tree.user_id && tree.user_id === req.user.id);

        res.json({ ...tree, isOwner });

    } catch (error) {
        console.error('Error fetching tree data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new tree data — requires sign-in; the creator becomes the owner.
router.post('/', requireAuth, async (req, res) => {
    const { title, tree_data } = req.body;
    const validation = validateAndSanitizeInput(title, tree_data);

    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const results = await pool.query(
            `INSERT INTO trees (title, tree_data, user_id) VALUES ($1, $2, $3) RETURNING *`,
            [validation.cleanTitle, validation.tree_data, req.user.id]
        );

        res.status(201).json(results.rows[0]);

    } catch (error) {
        console.error('Error creating tree data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update tree data by ID — requires sign-in AND ownership.
router.put('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { title, tree_data, id: bodyId } = req.body;

    if (bodyId !== undefined) {
        return res.status(400).json({ error: 'Do not include id in the update body. Use the URL parameter instead.' });
    }

    const validation = validateAndSanitizeInput(title, tree_data);

    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const owner = await pool.query(`SELECT user_id FROM trees WHERE id = $1`, [id]);

        if (owner.rows.length === 0) {
            return res.status(404).json({ error: 'Tree not found' });
        }

        if (owner.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not own this tree.' });
        }

        const results = await pool.query(`UPDATE trees SET title = $1, tree_data = $2,
            updated_at = NOW() WHERE id = $3 RETURNING *`,
            [validation.cleanTitle, validation.tree_data, id]
        );

        res.json(results.rows[0]);

    } catch (error) {
        console.error('Error updating tree data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove tree data by ID — requires sign-in AND ownership.
router.delete('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const owner = await pool.query(`SELECT user_id FROM trees WHERE id = $1`, [id]);

        if (owner.rows.length === 0) {
            return res.status(404).json({ error: 'Tree not found' });
        }

        if (owner.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'You do not own this tree.' });
        }

        await pool.query(`DELETE FROM trees WHERE id = $1`, [id]);
        res.status(200).json({ message: 'Tree deleted successfully' });

    } catch (error) {
        console.error('Error deleting tree data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});




export default router;
