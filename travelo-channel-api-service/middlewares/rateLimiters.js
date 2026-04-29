const rateLimit = require('express-rate-limit');

// Strict per-IP limiter for unauthenticated login (defends against brute force).
const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: "Too many login attempts. Try again in a minute." },
});

// Per-partner limiter for authenticated endpoints (uses partner_uuid populated by requireApiPartner).
// Falls back to IP if partner is missing (defensive).
const partnerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req /*, res */) => req.partner?.partner_uuid || req.ip,
    message: { msg: "Rate limit exceeded for this partner. Try again in a minute." },
});

// Per-IP limiter for unauthenticated public endpoints (e.g. /documentation).
const publicLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { msg: "Too many requests. Try again in a minute." },
});

module.exports = { loginLimiter, partnerLimiter, publicLimiter };
