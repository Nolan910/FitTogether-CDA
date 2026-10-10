const path = require('path');
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const errorHandler = require('./Middleware/errorHandler');
const { corsOrigin } = require('./config/cors');

const app = express();

app.set('trust proxy', 1);
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(routes);
app.use(errorHandler);

module.exports = app;
