const express = require('express');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const morgan = require('morgan');
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');
const request = require('superagent');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // http logging

const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// https://api.themoviedb.org/3/search/movie/?api_key=7427fb7f3e98454434abddd4dd47ef96&query=willow

// we don't need this to be a protected route. it's okay to use this endpoint even if you're not logged in.
app.get('/movies', async(req, res) => {
  try {
    const movies = await request.get(`https://api.themoviedb.org/3/search/movie/?api_key=${process.env.MOVIE_API_KEY}&query=${req.query.search}`);
    
    res.json(movies.body);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/favorites', async(req, res) => {
  try {
    const data = await client.query(
      'SELECT * from favorites where owner_id=$1', 
      [req.userId],
    );
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

// here we use req.params because the variable is located in the URL.
// the client will hit this API with /DELETE /favorites/4
// because 4 lives in the URL, it is a req.params thing
app.delete('/api/favorites/:id', async(req, res) => {
  try {
    const data = await client.query(
      'DELETE from favorites where owner_id=$1 AND id=$2', 
      [req.userId, req.params.id],
    );
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});


// we use req.body for POST/PUT requests.
// we expect the client to supply an object in the POST body.
// on the client-side, this will look like .send(somePostBodyObject)
app.post('/api/favorites', async(req, res) => {
  try {
    const { 
      title,
      genre,
      director,
      year,
      poster,
      runtime,
      movie_db_id,
    } = req.body;
  
    const data = await client.query(`
    INSERT INTO favorites (
      title,
      genre,
      director,
      year,
      poster,
      runtime,
      movie_db_id,
      owner_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
`,
    [
      title,
      genre,
      director,
      year,
      poster,
      runtime,
      movie_db_id,
      req.userId
    ]);
    
    res.json(data.rows);
  } catch(e) {
    
    res.status(500).json({ error: e.message });
  }
});

app.use(require('./middleware/error'));

module.exports = app;
