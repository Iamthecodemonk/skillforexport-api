import nodemailer from 'nodemailer';
import logger from './logger.js';

const smtpLogger = logger.child('SMTP');
import 'dotenv/config';

const emailConfig = {
  host: process.env.SMTP_HOST || 'mail.sigmaglobalsolutions.com',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true' || true, 
  auth: {
    user: process.env.SMTP_USER || '',
    // CHANGE THIS LINE:
    pass: process.env.SMTP_PASS || '' 
  }
};
// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

/**
 * Email templates for different purposes
 */
/**
 * Email templates for different purposes
 */
export const emailTemplates = {
  /**
   * OTP verification email
   */
  otp: (recipientEmail, otpCode, expiresInMinutes = 10) => ({
    subject: 'Your Verification Code',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333;">Email Verification</h2>
          <p style="color: #666; margin: 15px 0;">Hello,</p>
          <p style="color: #666; margin: 15px 0;">
            You requested a verification code. Here's your one-time password (OTP):
          </p>
          <div style="background-color: #007bff; color: white; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="margin: 0; font-size: 32px; letter-spacing: 2px;">${otpCode}</h1>
          </div>
          <p style="color: #666; margin: 15px 0;">
            This code will expire in <strong>${expiresInMinutes} minutes</strong>.
          </p>
          <p style="color: #999; font-size: 12px; margin: 20px 0;">
            If you did not request this, please ignore this email.
          </p>
        </div>
      </div>
    `,
    text: `Your verification code is: ${otpCode}\nThis code will expire in ${expiresInMinutes} minutes.`
  }),

  /**
   * Password reset email
   */
  passwordReset: (recipientEmail, resetLink, expiresInHours = 24) => ({
    subject: 'Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p style="color: #666; margin: 15px 0;">Hello,</p>
          <p style="color: #666; margin: 15px 0;">
            We received a request to reset your password. Click the button below to set a new password:
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetLink}" style="background-color: #28a745; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; margin: 15px 0;">
            This link will expire in <strong>${expiresInHours} hours</strong>.
          </p>
          <p style="color: #999; font-size: 12px; margin: 20px 0;">
            If you did not request a password reset, please ignore this email. Your password will not change.
          </p>
        </div>
      </div>
    `,
    text: `Click the link below to reset your password:\n${resetLink}\n\nThis link will expire in ${expiresInHours} hours.`
  }),

  /**
   * Welcome email for new users
   */
  welcome: (userName, recipientEmail) => ({
    subject: 'Welcome! Lets Get Started',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333;">Welcome, ${userName}!</h2>
          <p style="color: #666; margin: 15px 0;">
            Thank you for joining us. Your account has been successfully created.
          </p>
          <p style="color: #666; margin: 15px 0;">
            You can now log in to your account and start exploring all the amazing features we have to offer.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${process.env.APP_URL || 'https://skillforexport.com'}/login" style="background-color: #007bff; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
          <p style="color: #999; font-size: 12px; margin: 20px 0;">
            If you have any questions, feel free to reach out to our support team.
          </p>
        </div>
      </div>
    `,
    text: `Welcome, ${userName}!\n\nYour account has been created. Log in to get started.`
  }),

  /**
   * Account confirmation email
   */
  confirmation: (userName, recipientEmail, confirmLink) => ({
    subject: 'Confirm Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
          <h2 style="color: #333;">Confirm Your Email</h2>
          <p style="color: #666; margin: 15px 0;">Hi ${userName},</p>
          <p style="color: #666; margin: 15px 0;">
            Please confirm your email address by clicking the button below:
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${confirmLink}" style="background-color: #17a2b8; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; display: inline-block;">
              Confirm Email
            </a>
          </div>
          <p style="color: #999; font-size: 12px; margin: 20px 0;">
            This link will expire in 24 hours.
          </p>
        </div>
      </div>
    `,
    text: `Click the link below to confirm your email:\n${confirmLink}`
  })
};

/**
 * Send raw email (used by workers and services)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text content
 */
export async function sendEmail(to, subject, html, text) {
  try {
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      smtpLogger.warn(`Email to ${to} skipped - credentials missing`, { missingField: emailConfig.auth.user ? 'SMTP_PASS' : 'SMTP_USER' });
      return { skipped: true, reason: 'SMTP credentials missing (SMTP_USER or SMTP_PASS)' };
    }

    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || `SkillForExport <${emailConfig.auth.user}>`,
      to,
      subject,
      html,
      text
    });
    
    smtpLogger.debug(`Email sent to ${to}`, { subject, messageId: result.messageId });
    return result;
  } catch (error) {
    smtpLogger.error(`Failed to send email to ${to}`, { subject, error: error.message });
    throw error;
  }
}

/**
 * Verify SMTP connection
 * @returns {Promise<boolean>} - True if connection is successful
 */
export async function verifyEmailConfig() {
  try {
    await transporter.verify();
    smtpLogger.info('Email service verified');
    return true;
  } catch (error) {
    smtpLogger.error('Email service verification failed', { error: error.message });
    return false;
  }
}
