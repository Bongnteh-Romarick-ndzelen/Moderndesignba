import crypto from 'crypto';
import nodemailer from 'nodemailer';

// Flag to track if Gmail failed and we should fallback to Ethereal
let gmailFailed = false;

// Create a transporter object using the default SMTP transport
const createTransporter = () => {
    // In production, you would use a real email service like SendGrid, Mailgun, etc.
    // For development, you can use ethereal.email to test emails
    let config = {
        host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL_USER || 'your-email@example.com',
            pass: (process.env.EMAIL_PASS || 'your-email-password').replace(/\s+/g, '') // Remove spaces if any
        },
        // Add timeout configuration
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 30000, // 30 seconds
    };

    // If Gmail failed before, use Ethereal Email as fallback
    if (gmailFailed && config.host.includes('gmail')) {
        if (process.env.NODE_ENV === 'development') {
            console.log('Switching to Ethereal Email fallback due to previous Gmail failure');
        }
        config = {
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: process.env.ETHEREAL_USER || 'your-ethereal-email@ethereal.email',
                pass: process.env.ETHEREAL_PASS || 'your-ethereal-password'
            }
        };
    }

    // Log configuration in development for debugging
    if (process.env.NODE_ENV === 'development') {
        console.log('Email configuration:', {
            host: config.host,
            port: config.port,
            secure: config.secure,
            user: config.auth.user,
            // Don't log password for security
        });

        // Additional Gmail-specific debugging
        if (config.host.includes('gmail') && !gmailFailed) {
            console.log('Gmail detected - ensure 2FA is enabled and app password is used without spaces');
        }
    }

    return nodemailer.createTransport(config);
};

// Generate email verification token
export const generateEmailVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Send verification email
export const sendVerificationEmail = async (user) => {
    try {
        const transporter = createTransporter();

        const verificationUrl = `${process.env.CLIENT_URL || 'https://www.shielderas.org'}/verify-email?token=${user.emailVerificationToken}&email=${encodeURIComponent(user.email)}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Shielderas" <no-reply@shieldera.com>',
            to: user.email,
            subject: 'Verify your email address',
            html: `
                <html>
                    <head>
                        <style type="text/css">
                            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
                            
                            body {
                                font-family: 'Poppins', Arial, sans-serif;
                                line-height: 1.7;
                                color: #444;
                                background-color: #f7f9fc;
                                margin: 0;
                                padding: 20px;
                                font-size: 17px;
                            }
                            .email-container {
                                max-width: 600px;
                                margin: 0 auto;
                                background: white;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                            }
                            .header {
                                background: linear-gradient(135deg, #0066ff 0%, #0033aa 100%);
                                padding: 20px;
                                text-align: center;
                                font-size: 34px;
                                font-weight:bold;
                                color: linear-gradient(135deg,rgb(153, 16, 146) 0%,rgb(209, 163, 10) 100%);
                            }
                            .logo {
                                height: 55px;
                                margin-bottom: 15px;
                            }
                            .content {
                                padding: 30px;
                                font-size: 18px;
                                color:rgb(224, 224, 243);

                            }
                            h2 {
                                color: #2c3e50;
                                margin-top: 0;
                                font-size: 30px;
                                font-weight: 600;
                            }
                            .verification-button {
                                display: inline-block;
                                background: linear-gradient(135deg, #0066ff 0%, #0033aa 100%);
                                color: white !important;
                                text-decoration: none;
                                padding: 16px 32px;
                                border-radius: 8px;
                                font-weight: 500;
                                font-size: 19px;
                                margin: 20px 0;
                                box-shadow: 0 4px 8px rgba(0, 102, 255, 0.2);
                                transition: all 0.3s ease;
                            }
                            .verification-button:hover {
                                transform: translateY(-2px);
                                box-shadow: 0 6px 12px rgba(0, 102, 255, 0.3);
                            }
                            .link-fallback {
                                background: #f5f7fa;
                                padding: 15px;
                                border-radius: 8px;
                                word-break: break-all;
                                font-size: 15px;
                                color: #555;
                                margin: 20px 0;
                            }
                            .footer {
                                text-align: center;
                                padding: 20px;
                                color: #999;
                                font-size: 13px;
                                border-top: 1px solid #eee;
                            }
                            .expiry-note {
                                color: #e74c3c;
                                font-weight: 500;
                                margin: 15px 0;
                                font-size: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                <!-- Updated logo path -->
                                <!--img src="/favicon-32x32.png" alt="Shieldera Logo" class="logo" --> SHIELDERAS
                            </div>
                            
                            <div class="content">
                                <h2>Welcome to Shielderas!</h2>
                                <p>Hi ${user.fullName},</p>
                                <p>Thank you for signing up. Please verify your email address to complete your registration and access all features:</p>
                                
                                <div style="text-align: center;">
                                    <a href="${verificationUrl}" class="verification-button">Verify Email Address</a>
                                </div>
                                
                                <p>Or copy and paste this URL into your browser:</p>
                                <div class="link-fallback">${verificationUrl}</div>
                                
                                <p class="expiry-note">⚠️ This verification link will expire in 24 hours.</p>
                                
                                <p>If you didn't create an account with Shieldera, please ignore this email or contact our support team.</p>
                            </div>
                            
                            <div class="footer">
                                © ${new Date().getFullYear()} Shielderas. All rights reserved.<br>
                                <small>123 Business Ave, Suite 100, San Francisco, CA 94107</small>
                            </div>
                        </div>
                    </body>
                    </html>

            `
        };

        // Add more detailed logging for debugging
        if (process.env.NODE_ENV === 'development') {
            console.log('Attempting to send email to:', user.email);
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent: %s', info.messageId);

        // Log additional info in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Email sent successfully to:', user.email);
        }

        // Preview only available when sending through an Ethereal account
        if (process.env.NODE_ENV === 'development') {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        // Set flag to fallback to Ethereal Email if Gmail fails
        if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('gmail')) {
            gmailFailed = true;
            if (process.env.NODE_ENV === 'development') {
                console.log('Gmail failed, will fallback to Ethereal Email on next attempt');
                console.log('For Ethereal Email setup, visit: https://ethereal.email/');
            }
        }

        console.error('Error sending verification email:', error);
        throw error;
    }
};


// Send welcome email after successful verification
export const sendWelcomeEmail = async (user) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Shielderas" <no-reply@shieldera.com>',
            to: user.email,
            subject: 'Welcome to Shielderas - Your Account is Verified!',
            html: `
                <html>
                    <head>
                        <style type="text/css">
                            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
                            
                            body {
                                font-family: 'Poppins', Arial, sans-serif;
                                line-height: 1.7;
                                color: #444;
                                background-color: #f7f9fc;
                                margin: 0;
                                padding: 20px;
                                font-size: 17px;
                            }
                            .email-container {
                                max-width: 600px;
                                margin: 0 auto;
                                background: white;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                            }
                            .header {
                                background: linear-gradient(135deg, #00cc66 0%, #008844 100%);
                                padding: 20px;
                                text-align: center;
                                font-size: 34px;
                                font-weight: bold;
                                color: white;
                            }
                            .content {
                                padding: 30px;
                                font-size: 18px;
                            }
                            h2 {
                                color: #2c3e50;
                                margin-top: 0;
                                font-size: 30px;
                                font-weight: 600;
                            }
                            .cta-button {
                                display: inline-block;
                                background: linear-gradient(135deg, #00cc66 0%, #008844 100%);
                                color: white !important;
                                text-decoration: none;
                                padding: 16px 32px;
                                border-radius: 8px;
                                font-weight: 500;
                                font-size: 19px;
                                margin: 20px 0;
                                box-shadow: 0 4px 8px rgba(0, 204, 102, 0.2);
                                transition: all 0.3s ease;
                            }
                            .cta-button:hover {
                                transform: translateY(-2px);
                                box-shadow: 0 6px 12px rgba(0, 204, 102, 0.3);
                            }
                            .feature-list {
                                margin: 20px 0;
                                padding-left: 20px;
                            }
                            .feature-list li {
                                margin-bottom: 10px;
                            }
                            .footer {
                                text-align: center;
                                padding: 20px;
                                color: #999;
                                font-size: 13px;
                                border-top: 1px solid #eee;
                            }
                            .support-note {
                                background: #f5f7fa;
                                padding: 15px;
                                border-radius: 8px;
                                margin: 20px 0;
                                font-size: 15px;
                                color: #555;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                SHIELDERAS
                            </div>
                            
                            <div class="content">
                                <h2>Welcome to Shielderas!</h2>
                                <p>Hi ${user.fullName},</p>
                                <p>Congratulations! You're welcom to shielderas. Your email has been successfully verified and your account is now fully activated.</p>
                                
                                <p>You now have access to all features of our platform:</p>
                                
                                <ul class="feature-list">
                                    <li>Secure file storage and sharing</li>
                                    <li>Advanced privacy controls</li>
                                    <li>Real-time collaboration tools</li>
                                    <li>Premium support services</li>
                                </ul>
                                
                                <div style="text-align: center;">
                                    <a href="${process.env.CLIENT_URL || 'https://www.shielderas.org'}/dashboard/student" class="cta-button">Go to Dashboard</a>
                                </div>
                                
                                <div class="support-note">
                                    <strong>Need help getting started?</strong> Check out our <a href="${process.env.CLIENT_URL || 'https://www.shielderas.org'}/help-center">Help Center</a> or contact our support team at support@shielderas.org.
                                </div>
                                
                                <p>We're excited to have you on board!</p>
                                
                                <p>Best regards,<br>The Shielderas Team</p>
                            </div>
                            
                            <div class="footer">
                                © ${new Date().getFullYear()} Shielderas. All rights reserved.<br>
                                <small>123 Business Ave, Suite 100, San Francisco, CA 94107</small>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };

        if (process.env.NODE_ENV === 'development') {
            console.log('Attempting to send welcome email to:', user.email);
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Welcome email sent: %s', info.messageId);

        if (process.env.NODE_ENV === 'development') {
            console.log('Welcome email sent successfully to:', user.email);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error;
    }
};


// Password Reset Email Utilities
export const sendPasswordResetEmail = async (user, resetToken) => {
    try {
        const transporter = createTransporter();

        const resetUrl = `${process.env.CLIENT_URL || 'https://www.shielderas.org'}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Shielderas Support" <support@shielderas.org>',
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <html>
                    <head>
                        <style type="text/css">
                            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
                            
                            body {
                                font-family: 'Poppins', Arial, sans-serif;
                                line-height: 1.7;
                                color: #444;
                                background-color: #f7f9fc;
                                margin: 0;
                                padding: 20px;
                                font-size: 15px;
                            }
                            .email-container {
                                max-width: 600px;
                                margin: 0 auto;
                                background: white;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                            }
                            .header {
                                background: linear-gradient(135deg,rgb(17, 55, 124) 0%,rgb(0, 82, 204) 100%);
                                padding: 10px;
                                text-align: center;
                                font-size: 34px;
                                font-weight: bold;
                                color: white;
                            }
                            .logo {
                                height: 55px;
                                margin-bottom: 15px;
                            }
                            .content {
                                padding: 30px;
                                font-size: 17px;
                            }
                            h2 {
                                color: #2c3e50;
                                margin-top: 0;
                                font-size: 30px;
                                font-weight: 600;
                            }
                            .reset-button {
                                display: inline-block;
                                background: linear-gradient(135deg, #ff4d4d 0%, #cc0000 100%);
                                color: white !important;
                                text-decoration: none;
                                padding: 16px 32px;
                                border-radius: 8px;
                                font-weight: 500;
                                font-size: 19px;
                                margin: 20px 0;
                                box-shadow: 0 4px 8px rgba(255, 77, 77, 0.2);
                                transition: all 0.3s ease;
                            }
                            .reset-button:hover {
                                transform: translateY(-2px);
                                box-shadow: 0 6px 12px rgba(255, 77, 77, 0.3);
                            }
                            .link-fallback {
                                background: #f5f7fa;
                                padding: 15px;
                                border-radius: 8px;
                                word-break: break-all;
                                font-size: 15px;
                                color: #555;
                                margin: 20px 0;
                            }
                            .footer {
                                text-align: center;
                                padding: 20px;
                                color: #999;
                                font-size: 13px;
                                border-top: 1px solid #eee;
                            }
                            .expiry-note {
                                color: #e74c3c;
                                font-weight: 500;
                                margin: 15px 0;
                                font-size: 15px;
                            }
                            .security-note {
                                background: #fff8e1;
                                padding: 15px;
                                border-radius: 8px;
                                border-left: 4px solid #ffc107;
                                margin: 20px 0;
                                font-size: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                <!--img src="/favicon-32x32.png" alt="Shieldera Logo" class="logo"--> SHIELDERAS
                            </div>
                            
                            <div class="content">
                                <h2>Password Reset Request</h2>
                                <p>Hi ${user.fullName},</p>
                                <p>We received a request to reset your Shielderas account password. Click the button below to proceed:</p>
                                
                                <div style="text-align: center;">
                                    <a href="${resetUrl}" class="reset-button">Reset Password</a>
                                </div>
                                
                                <p>Or copy and paste this URL into your browser:</p>
                                <div class="link-fallback">${resetUrl}</div>
                                
                                <p class="expiry-note">⚠️ This password reset link will expire in 1 hour.</p>
                                
                                <div class="security-note">
                                    <strong>Security notice:</strong> If you didn't request this password reset, please ignore this email or 
                                    <a href="mailto:support@shielderas.org" style="color: #0066ff;">contact our support team</a> immediately.
                                </div>
                                
                                <p>For security reasons, we recommend:</p>
                                <ul>
                                    <li>Choosing a strong password you haven't used before</li>
                                    <li>Enabling two-factor authentication</li>
                                    <li>Regularly updating your password</li>
                                </ul>
                            </div>
                            
                            <div class="footer">
                                © ${new Date().getFullYear()} Shielderas Security Team<br>
                                <small>123 Security Plaza, Suite 200, San Francisco, CA 94107</small>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Attempting to send password reset email to:', user.email);
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent: %s', info.messageId);

        // Development-specific logging
        if (process.env.NODE_ENV === 'development') {
            console.log('Password reset email sent successfully to:', user.email);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        // Handle Gmail failures with fallback to Ethereal
        if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('gmail')) {
            gmailFailed = true;
            if (process.env.NODE_ENV === 'development') {
                console.log('Gmail failed, will fallback to Ethereal Email on next attempt');
            }
        }

        console.error('Error sending password reset email:', error);
        throw error;
    }
};

// Password Reset Email Utilities
export const sendPasswordResetSuccessEmail = async (user) => {
    try {
        const transporter = createTransporter();

        const loginUrl = `${process.env.CLIENT_URL || `https://www.shielderas.org/login`}`;

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Shielderas Support" <support@shielderas.org>',
            to: user.email,
            subject: 'Password Reseted Successfully',
            html: `
                <html>
                    <head>
                        <style type="text/css">
                            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap');
                            
                            body {
                                font-family: 'Poppins', Arial, sans-serif;
                                line-height: 1.7;
                                color: #444;
                                background-color: #f7f9fc;
                                margin: 0;
                                padding: 20px;
                                font-size: 15px;
                            }
                            .email-container {
                                max-width: 600px;
                                margin: 0 auto;
                                background: white;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
                            }
                            .header {
                                background: linear-gradient(135deg,rgb(17, 55, 124) 0%,rgb(0, 82, 204) 100%);
                                padding: 10px;
                                text-align: center;
                                font-size: 34px;
                                font-weight: bold;
                                color: white;
                            }
                            .logo {
                                height: 55px;
                                margin-bottom: 15px;
                            }
                            .content {
                                padding: 30px;
                                font-size: 17px;
                            }
                            h2 {
                                color: #2c3e50;
                                margin-top: 0;
                                font-size: 30px;
                                font-weight: 600;
                            }
                            .reset-button {
                                display: inline-block;
                                background: linear-gradient(135deg, #ff4d4d 0%, #cc0000 100%);
                                color: white !important;
                                text-decoration: none;
                                padding: 16px 32px;
                                border-radius: 8px;
                                font-weight: 500;
                                font-size: 19px;
                                margin: 20px 0;
                                box-shadow: 0 4px 8px rgba(255, 77, 77, 0.2);
                                transition: all 0.3s ease;
                            }
                            .reset-button:hover {
                                transform: translateY(-2px);
                                box-shadow: 0 6px 12px rgba(255, 77, 77, 0.3);
                            }
                            .link-fallback {
                                background: #f5f7fa;
                                padding: 15px;
                                border-radius: 8px;
                                word-break: break-all;
                                font-size: 15px;
                                color: #555;
                                margin: 20px 0;
                            }
                            .footer {
                                text-align: center;
                                padding: 20px;
                                color: #999;
                                font-size: 13px;
                                border-top: 1px solid #eee;
                            }
                            .expiry-note {
                                color: #e74c3c;
                                font-weight: 500;
                                margin: 15px 0;
                                font-size: 15px;
                            }
                            .security-note {
                                background: #fff8e1;
                                padding: 15px;
                                border-radius: 8px;
                                border-left: 4px solid #ffc107;
                                margin: 20px 0;
                                font-size: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                <!--img src="/public/favicon-32x32.png" alt="Shieldera Logo" class="logo"--> SHIELDERAS
                            </div>
                            
                            <div class="content">
                                <h2>Password Reset Request</h2>
                                <p>Hi ${user.fullName},</p>
                                <p>Your Password has been reseted successfully. Please click the button below and Login to your account</p>
                                
                                <div style="text-align: center;">
                                    <a href="${loginUrl}" class="reset-button">Reset Password</a>
                                </div>
                                
                                <p>Or copy and paste this URL into your browser:</p>
                                <div class="link-fallback">${loginUrl}</div>
                                
                                <p class="expiry-note">⚠️ If you didn't do this, please contact support</p>
                                
                                <div class="security-note">
                                    <strong>Security notice:</strong> If you didn't reset your password,
                                    <a href="mailto:support@shielderas.org" style="color: #0066ff;">contact our support team</a> immediately.
                                </div>
                                
                                <p>For security reasons, we recommend:</p>
                                <ul>
                                    <li>Choosing a strong password you haven't used before</li>
                                    <li>Enabling two-factor authentication</li>
                                    <li>Regularly updating your password</li>
                                </ul>
                            </div>
                            
                            <div class="footer">
                                © ${new Date().getFullYear()} Shielderas Security Team<br>
                                <small>123 Security Plaza, Suite 200, San Francisco, CA 94107</small>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };

        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Attempting to send password reset email to:', user.email);
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent: %s', info.messageId);

        // Development-specific logging
        if (process.env.NODE_ENV === 'development') {
            console.log('Password reset email sent successfully to:', user.email);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        // Handle Gmail failures with fallback to Ethereal
        if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('gmail')) {
            gmailFailed = true;
            if (process.env.NODE_ENV === 'development') {
                console.log('Gmail failed, will fallback to Ethereal Email on next attempt');
            }
        }

        console.error('Error sending password reset email:', error);
        throw error;
    }
};