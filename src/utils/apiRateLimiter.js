// Simple rate limiter middleware (no-op for now)
export const apiLimiter = (req, res, next) => next();
export const authLimiter = (req, res, next) => next();
export const chatLimiter = (req, res, next) => next();
