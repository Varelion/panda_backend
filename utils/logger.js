const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatTimestamp() {
    return new Date().toISOString();
  }

  formatLogEntry(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: this.formatTimestamp(),
      level: level.toUpperCase(),
      message,
      ...meta
    }) + '\n';
  }

  writeToFile(filename, entry) {
    const filePath = path.join(this.logDir, filename);
    fs.appendFileSync(filePath, entry);
  }

  log(level, message, meta = {}) {
    const entry = this.formatLogEntry(level, message, meta);
    
    // Write to console
    console.log(entry.trim());
    
    // Write to general log file
    this.writeToFile('app.log', entry);
    
    // Write to level-specific log file
    if (level === 'error') {
      this.writeToFile('error.log', entry);
    } else if (level === 'auth') {
      this.writeToFile('auth.log', entry);
    } else if (level === 'security') {
      this.writeToFile('security.log', entry);
    }
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  error(message, meta = {}) {
    this.log('error', message, meta);
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  auth(message, meta = {}) {
    this.log('auth', message, meta);
  }

  security(message, meta = {}) {
    this.log('security', message, meta);
  }

  // Authentication specific logging methods
  loginAttempt(email, username, success, ip, userAgent) {
    this.auth('Login attempt', {
      email: email || null,
      username: username || null,
      success,
      ip,
      userAgent,
      type: 'login_attempt'
    });
  }

  passwordChange(userId, username, success, ip) {
    this.auth('Password change', {
      userId,
      username,
      success,
      ip,
      type: 'password_change'
    });
  }

  passwordReset(email, username, action, ip) {
    this.auth('Password reset', {
      email,
      username,
      action, // 'requested' or 'completed'
      ip,
      type: 'password_reset'
    });
  }

  accountCreated(userId, username, email, ip) {
    this.auth('Account created', {
      userId,
      username,
      email,
      ip,
      type: 'account_created'
    });
  }

  suspiciousActivity(message, meta = {}) {
    this.security('Suspicious activity detected', {
      ...meta,
      type: 'suspicious_activity'
    });
  }
}

module.exports = new Logger();