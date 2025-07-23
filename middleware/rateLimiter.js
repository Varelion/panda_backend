const logger = require('../utils/logger');

class RateLimiter {
  constructor() {
    // Store attempts in memory (in production, use Redis)
    this.attempts = new Map();
    this.blockedIPs = new Map();

    // Clean up old entries every 15 minutes
    setInterval(() => this.cleanup(), 15 * 60 * 1000);
  }

  getKey(ip, type = 'general') {
    return `${ip}:${type}`;
  }

  getAttempts(ip, type = 'general') {
    const key = this.getKey(ip, type);
    const data = this.attempts.get(key);

    if (!data) {
      return { count: 0, firstAttempt: Date.now(), lastAttempt: Date.now() };
    }

    return data;
  }

  addAttempt(ip, type = 'general') {
    const key = this.getKey(ip, type);
    const existing = this.attempts.get(key);

    if (existing) {
      existing.count++;
      existing.lastAttempt = Date.now();
    } else {
      this.attempts.set(key, {
        count: 1,
        firstAttempt: Date.now(),
        lastAttempt: Date.now()
      });
    }
  }

  isBlocked(ip) {
    const blockData = this.blockedIPs.get(ip);
    if (!blockData) return false;

    if (Date.now() > blockData.until) {
      this.blockedIPs.delete(ip);
      return false;
    }

    return true;
  }

  blockIP(ip, durationMs) {
    this.blockedIPs.set(ip, {
      until: Date.now() + durationMs,
      blockedAt: Date.now()
    });

    logger.security('IP blocked due to rate limiting', {
      ip,
      duration: durationMs,
      until: new Date(Date.now() + durationMs)
    });
  }

  cleanup() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Clean up old attempts (older than 1 hour)
    for (const [key, data] of this.attempts.entries()) {
      if (now - data.lastAttempt > oneHour) {
        this.attempts.delete(key);
      }
    }

    // Clean up expired blocks
    for (const [ip, blockData] of this.blockedIPs.entries()) {
      if (now > blockData.until) {
        this.blockedIPs.delete(ip);
      }
    }
  }

  // General rate limiting
  general(maxAttempts = 100, windowMs = 15 * 60 * 1000) { // 100 requests per 15 minutes
    return (req, res, next) => {
      const ip = req.ip;

      if (this.isBlocked(ip)) {
        logger.security('Blocked IP attempted request', { ip, endpoint: req.path });
        return res.status(429).json({
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((this.blockedIPs.get(ip).until - Date.now()) / 1000)
        });
      }

      const attempts = this.getAttempts(ip, 'general');

      // Reset if window has passed
      if (Date.now() - attempts.firstAttempt > windowMs) {
        this.attempts.delete(this.getKey(ip, 'general'));
        this.addAttempt(ip, 'general');
        return next();
      }

      if (attempts.count >= maxAttempts) {
        this.blockIP(ip, 30 * 60 * 1000); // Block for 30 minutes
        return res.status(429).json({
          message: 'Too many requests. Please try again later.',
          retryAfter: 1800 // 30 minutes
        });
      }

      this.addAttempt(ip, 'general');
      next();
    };
  }

  // Authentication rate limiting (stricter)
  auth(maxAttempts = 50000, windowMs = 15 * 60 * 1000, blockDurationMs = 15 * 60 * 1000) {
    return (req, res, next) => {
      const ip = req.ip;

      if (this.isBlocked(ip)) {
        logger.security('Blocked IP attempted auth', { ip, endpoint: req.path });
        return res.status(429).json({
          message: 'Too many authentication attempts. Please try again later.',
          retryAfter: Math.ceil((this.blockedIPs.get(ip).until - Date.now()) / 1000)
        });
      }

      const attempts = this.getAttempts(ip, 'auth');

      // Reset if window has passed
      if (Date.now() - attempts.firstAttempt > windowMs) {
        this.attempts.delete(this.getKey(ip, 'auth'));
        this.addAttempt(ip, 'auth');
        return next();
      }

      if (attempts.count >= maxAttempts) {
        this.blockIP(ip, blockDurationMs);
        logger.security('IP blocked due to excessive auth attempts', {
          ip,
          attempts: attempts.count,
          timeWindow: windowMs,
          endpoint: req.path
        });
        return res.status(429).json({
          message: 'Too many authentication attempts. Please try again later.',
          retryAfter: Math.ceil(blockDurationMs / 1000)
        });
      }

      this.addAttempt(ip, 'auth');
      next();
    };
  }

  // Password reset rate limiting
  passwordReset(maxAttempts = 3, windowMs = 60 * 60 * 1000) { // 3 attempts per hour
    return (req, res, next) => {
      const ip = req.ip;

      if (this.isBlocked(ip)) {
        return res.status(429).json({
          message: 'Too many password reset attempts. Please try again later.',
          retryAfter: Math.ceil((this.blockedIPs.get(ip).until - Date.now()) / 1000)
        });
      }

      const attempts = this.getAttempts(ip, 'password_reset');

      // Reset if window has passed
      if (Date.now() - attempts.firstAttempt > windowMs) {
        this.attempts.delete(this.getKey(ip, 'password_reset'));
        this.addAttempt(ip, 'password_reset');
        return next();
      }

      if (attempts.count >= maxAttempts) {
        this.blockIP(ip, 2 * 60 * 60 * 1000); // Block for 2 hours
        logger.security('IP blocked due to excessive password reset attempts', {
          ip,
          attempts: attempts.count,
          endpoint: req.path
        });
        return res.status(429).json({
          message: 'Too many password reset attempts. Please try again later.',
          retryAfter: 7200 // 2 hours
        });
      }

      this.addAttempt(ip, 'password_reset');
      next();
    };
  }
}

module.exports = new RateLimiter();
