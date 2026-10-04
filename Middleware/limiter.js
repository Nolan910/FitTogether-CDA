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

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = limiteur;
module.exports.loginLimiter = loginLimiter;
