export default class User {
  // Email validation regex - domain rule
  static EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor({ id = null, email, password = null, createdAt = null, created_at = null, updatedAt = null, updated_at = null, role = null }) {
    // Validate email format at construction time
    if (email && !User.isValidEmail(email)) {
      throw new Error('invalid_email_format');
    }
    this.id = id;
    this.email = email;
    this.password = password;
    this.role = role;
    // Handle both camelCase and snake_case from Prisma
    this.createdAt = createdAt || (created_at ? new Date(created_at) : null);
    this.updatedAt = updatedAt || (updated_at ? new Date(updated_at) : null);
  }

  // Domain validation: Email format
  static isValidEmail(email) {
    return User.EMAIL_REGEX.test(email);
  }

  toRecord() {
    return {
      id: this.id,
      email: this.email,
      password: this.password,
      role: this.role,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  toPlainObject() {
    return {
      id: this.id,
      email: this.email
    };
  }
}
