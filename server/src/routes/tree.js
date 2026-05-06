// CRUD for the family tree data
import { Router } from 'express';
import pool from '../db.js';
import { validateAndSanitizeInput } from '../utils/treeValidation.js';


const router = Router();

// Get tree by ID

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try{
        const results = await pool.query(`SELECT * FROM trees WHERE id = $1`, [id]);
        
        if(results.rows.length === 0) {
            return res.status(404).json({ error: 'Tree not found' });
        }

        res.json(results.rows[0]);
        
    } catch(error) {
            console.error('Error fetching tree data:', error);
            res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new tree data

router.post('/', async (req, res) => {
    const { title, tree_data } = req.body;
    const validation = validateAndSanitizeInput(title, tree_data);

    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const results = await pool.query(
            `INSERT INTO trees (title, tree_data) VALUES ($1, $2) RETURNING *`, 
            [validation.cleanTitle, validation.tree_data]
        );

        res.status(201).json(results.rows[0]);

    } catch(error) {
        console.error('Error creating tree data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

//Update tree data by ID

router.put('/:id', async (req, res) => {
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
        const results = await pool.query(`UPDATE trees SET title = $1, tree_data = $2, 
            updated_at = NOW() WHERE id = $3 RETURNING *`,
            [validation.cleanTitle, validation.tree_data, id]
        );

        if(results.rows.length === 0) {
            return res.status(404).json({ error: 'Tree not found' });
        }

        res.json(results.rows[0]);

    } catch(error) {
        console.error('Error updating tree data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
})

// Delete tree data by ID

router.delete('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const results = await pool.query(`DELETE FROM trees WHERE id = $1 RETURNING *`, [id]);

        if(results.rows.length === 0) {
            return res.status(404).json({ error: 'Tree not found' });
        }
        res.status(200).json({ message: 'Tree deleted successfully' });

    } catch(error) {
        console.error('Error deleting tree data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
