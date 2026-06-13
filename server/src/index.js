// Server entry point
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pool from './db.js';
import passport from './auth/passport.js';
import treeRouter from './routes/tree.js';
import authRouter from './routes/auth.js';


const app = express();

//JSON body parsing middleware
// 1mb is generous for a large tree (~thousands of nodes) while capping abuse.
// Oversized bodies are rejected before parsing; malformed JSON is caught below.

app.use(express.json({ limit: '1mb' }));

const port = process.env.PORT || 3001;

// Sessions stored in Postgres (the `session` table from migration 004).
const PgSession = connectPgSimple(session);

app.use(session({
  store: new PgSession({ pool, tableName: 'session', createTableIfMissing: false }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false, // dev is http://localhost; set true behind HTTPS in prod
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRouter);

// Current logged-in user (or null). Never exposes password_hash.
app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });

  const { id, email, name, avatar_url } = req.user;
  res.json({ user: { id, email, name, avatar_url } });
});

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