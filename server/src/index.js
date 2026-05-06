// Server entry point
import 'dotenv/config';
import express from 'express';
import pool from './db.js';
import treeRouter from './routes/tree.js';


const app = express();

//JSON body parsing middleware

app.use(express.json());

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

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
})