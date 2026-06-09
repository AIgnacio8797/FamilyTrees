// Server entry point
import 'dotenv/config';
import express from 'express';
import pool from './db.js';
import treeRouter from './routes/tree.js';


const app = express();

//JSON body parsing middleware
// 1mb is generous for a large tree (~thousands of nodes) while capping abuse.
// Oversized bodies are rejected before parsing; malformed JSON is caught below.

app.use(express.json({ limit: '1mb' }));

const port = process.env.PORT || 3001; 

app.use('/api/trees', treeRouter);


app.get('/', (req, res) => {
    res.send('Family Trees backend is running');
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// JSON body error handler: return clean JSON for oversized or malformed bodies
// instead of Express's default HTML error page.
app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body is too large.' });
    }

    if (err?.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }

    return next(err);
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})