const rateLimit = require('express-rate-limit');

const skip = () => process.env.NODE_ENV === 'test';

const clientKey = (req) => req.get('cf-connecting-ip') || req.ip;

const limiteur = rateLimit({
    windowMs: 1 * 1000,
    max: 10,
    message: { message: 'Trop de requêtes. Essayez à nouveau plus tard' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    skip,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: clientKey,
    skip,
});

module.exports = limiteur;
module.exports.loginLimiter = loginLimiter;
module.exports.clientKey = clientKey;
