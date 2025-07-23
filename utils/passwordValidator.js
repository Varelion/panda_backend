class PasswordValidator {
  constructor() {
    this.minLength = 8;
    this.maxLength = 128;
  }

  validate(password) {
    const errors = [];
    const score = this.calculateScore(password);

    // Length check
    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }

    if (password.length > this.maxLength) {
      errors.push(`Password must be less than ${this.maxLength} characters long`);
    }

    // Character requirements
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common passwords check
    if (this.isCommonPassword(password)) {
      errors.push('Password is too common. Please choose a more unique password');
    }

    // Sequential characters check
    if (this.hasSequentialChars(password)) {
      errors.push('Password should not contain sequential characters (e.g., 123, abc)');
    }

    // Repeated characters check
    if (this.hasRepeatedChars(password)) {
      errors.push('Password should not contain too many repeated characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
      score,
      strength: this.getStrengthText(score)
    };
  }

  calculateScore(password) {
    let score = 0;

    // Length bonus
    score += Math.min(password.length * 2, 20);

    // Character variety bonus
    if (/[a-z]/.test(password)) score += 5;
    if (/[A-Z]/.test(password)) score += 5;
    if (/\d/.test(password)) score += 5;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 10;

    // Bonus for mixed case
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 5;

    // Bonus for numbers and letters
    if (/\d/.test(password) && /[a-zA-Z]/.test(password)) score += 5;

    // Bonus for special characters with letters/numbers
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) && /[a-zA-Z0-9]/.test(password)) {
      score += 5;
    }

    // Penalty for common patterns
    if (this.isCommonPassword(password)) score -= 20;
    if (this.hasSequentialChars(password)) score -= 10;
    if (this.hasRepeatedChars(password)) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  getStrengthText(score) {
    if (score < 30) return 'Very Weak';
    if (score < 50) return 'Weak';
    if (score < 70) return 'Fair';
    if (score < 85) return 'Good';
    return 'Strong';
  }

  isCommonPassword(password) {
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
      'qwerty123', 'admin123', '123123', 'welcome123', 'login', 'root',
      'toor', 'pass', '12345678', '1234', '12345', 'guest', 'test',
      'user', 'temp', 'demo', 'sample', 'default', 'changeme', 'master'
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  hasSequentialChars(password) {
    const lower = password.toLowerCase();
    
    // Check for sequential numbers
    for (let i = 0; i <= lower.length - 3; i++) {
      const substr = lower.substr(i, 3);
      if (/^\d{3}$/.test(substr)) {
        const first = parseInt(substr[0]);
        const second = parseInt(substr[1]);
        const third = parseInt(substr[2]);
        if (second === first + 1 && third === second + 1) {
          return true;
        }
      }
    }

    // Check for sequential letters
    for (let i = 0; i <= lower.length - 3; i++) {
      const substr = lower.substr(i, 3);
      if (/^[a-z]{3}$/.test(substr)) {
        const first = substr.charCodeAt(0);
        const second = substr.charCodeAt(1);
        const third = substr.charCodeAt(2);
        if (second === first + 1 && third === second + 1) {
          return true;
        }
      }
    }

    return false;
  }

  hasRepeatedChars(password) {
    // Check for more than 2 consecutive identical characters
    return /(.)\1{2,}/.test(password);
  }

  // Validate password strength for different contexts
  validateStrict(password) {
    const result = this.validate(password);
    
    // For strict validation, require a minimum score
    if (result.score < 50) {
      result.isValid = false;
      if (!result.errors.includes('Password strength is too weak')) {
        result.errors.push('Password strength is too weak. Please create a stronger password');
      }
    }

    return result;
  }

  // Basic validation (more lenient)
  validateBasic(password) {
    const errors = [];

    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (password.length > this.maxLength) {
      errors.push(`Password must be less than ${this.maxLength} characters long`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      score: this.calculateScore(password),
      strength: this.getStrengthText(this.calculateScore(password))
    };
  }
}

module.exports = new PasswordValidator();