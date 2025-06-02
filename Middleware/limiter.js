const express = require('express');
const rateLimit = require('express-rate-limit');

const app = express();

const limiteur = rateLimit({
    windowMs: 1 * 1000,
    max: 10,
    message: 'Trop de requêtes. Essayez à nouveau plus tard',
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = limiteur;