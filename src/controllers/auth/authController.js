import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import { generateEmailVerificationToken, sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendPasswordResetSuccessEmail } from '../../utils/emailVerification.js';

// Token generation helpers
const generateAccessToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

const generateRefreshToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
};

// Cookie configuration
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    partitioned: process.env.NODE_ENV === 'production',
    // Conditional domain setting
    // ...(process.env.NODE_ENV === 'production'
    //     ? { domain: process.env.COOKIE_DOMAIN || '.shielderas.org' }
    //     : {}
    // )
};

// Helper to sanitize user data
const sanitizeUser = (user) => {
    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.password;
    delete userObj.__v;
    return userObj;
};

// Signup Controller
export const signup = async (req, res) => {
    try {
        const { email, password, confirmPassword, fullName } = req.body;

        // Validation
        if (!email || !password || !confirmPassword || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Generate email verification token
        const emailVerificationToken = generateEmailVerificationToken();
        const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        // Create user
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({
            email,
            password: hashedPassword,
            fullName,
            isEmailVerified: false,
            emailVerificationToken,
            emailVerificationExpires
        });

        // Send verification email (non-blocking)
        try {
            sendVerificationEmail(user).catch(emailError => {
                console.error('Failed to send verification email:', emailError);
                // Don't fail the signup if email sending fails, but log it
            });
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Don't fail the signup if email sending fails, but log it
        }


        return res.status(201).json({
            success: true,
            message: 'User created successfully. Please check your email to verify your account.',
            data: {
                user: sanitizeUser(user)
            }
        });

    } catch (error) {
        console.error('Signup error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'Email already exists'
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(', ')
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Login Controller
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        const user = await User.findOne({ email }).select('+password');
        if (!user) {
            // Don't reveal whether user exists for security
            await bcrypt.compare(password, '$2a$12$fakehashforsecurity'); // Dummy comparison
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if email is verified
        if (!user.isEmailVerified) {
            return res.status(401).json({
                success: false,
                message: 'Please verify your email address before logging in'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        res.cookie('refreshToken', refreshToken, cookieOptions);

        return res.status(200).json({
            success: true,
            data: {
                user: sanitizeUser(user),
                accessToken
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Refresh Token Controller
export const refreshToken = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'No refresh token provided'
            });
        }

        // Verify token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        // Check user exists
        const user = await User.findById(decoded.id);
        if (!user) {
            res.clearCookie('refreshToken', cookieOptions);
            return res.status(401).json({  // Changed from 404 to 401
                success: false,
                message: 'User not found'
            });
        }

        // Generate new tokens
        const newAccessToken = generateAccessToken(user._id);
        const newRefreshToken = generateRefreshToken(user._id);

        // Set new refresh token cookie
        res.cookie('refreshToken', newRefreshToken, cookieOptions);

        return res.status(200).json({  // Explicit status code
            success: true,
            data: {
                accessToken: newAccessToken
            }
        });

    } catch (error) {
        console.error('Refresh token error:', error);
        res.clearCookie('refreshToken', cookieOptions);

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({  // Changed from 403 to 401
                success: false,
                message: 'Refresh token expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid refresh token'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Logout Controller
export const logout = (req, res) => {
    res.clearCookie('refreshToken', cookieOptions);
    return res.json({
        success: true,
        message: 'Logged out successfully'
    });
};

// Resend Verification Email Controller
export const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is already verified
        if (user.isEmailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email is already verified'
            });
        }

        // Generate new verification token and expiration
        const emailVerificationToken = generateEmailVerificationToken();
        const emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        // Update user with new token and expiration
        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationExpires = emailVerificationExpires;
        await user.save();

        // Send verification email
        try {
            await sendVerificationEmail(user);

            return res.status(200).json({
                success: true,
                message: 'Verification email sent successfully'
            });
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again later.'
            });
        }
    } catch (error) {
        console.error('Resend verification email error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Email Verification Controller
export const verifyEmail = async (req, res) => {
    try {
        const { token, email } = req.query;

        if (!token || !email) {
            return res.status(400).json({
                success: false,
                message: 'Missing token or email'
            });
        }

        // Find user with the verification token and email
        const user = await User.findOne({
            email,
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        // Update user as verified
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        // Send welcome email (non-blocking)
        try {
            sendWelcomeEmail(user).catch(emailError => {
                console.error('Failed to send welcome email:', emailError);
                // Don't fail the verification if email sending fails
            });
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Don't fail the verification if email sending fails
        }

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now log in.'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Forgot Password - Initiate password reset
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            // Don't reveal if user doesn't exist for security
            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent'
            });
        }

        // Generate password reset token (expires in 1 hour)
        const resetToken = jwt.sign(
            { id: user._id },
            process.env.RESET_TOKEN_SECRET,
            { expiresIn: '1h' }
        );

        // Set reset token and expiration on user
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Send password reset email (you'll need to implement this)
        try {
            await sendPasswordResetEmail(user, resetToken);

            return res.status(200).json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent'
            });
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send password reset email. Please try again later.'
            });
        }

    } catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Verify Password Reset Token
export const verifyResetToken = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Reset token is required'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.RESET_TOKEN_SECRET);

        // Check if user exists and token matches
        const user = await User.findOne({
            _id: decoded.id,
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Reset token is valid'
        });

    } catch (error) {
        console.error('Verify reset token error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset token'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Reset Password
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword, confirmPassword } = req.body;

        if (!token || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.RESET_TOKEN_SECRET);

        // Check if user exists and token matches
        const user = await User.findOne({
            _id: decoded.id,
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password and clear reset token
        user.password = hashedPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        // Send password reset success email
        try {
            await sendPasswordResetSuccessEmail(user.email, user.fullName);
        } catch (emailError) {
            console.error('Failed to send password reset success email:', emailError);
            // Don't fail the request if email fails, just log the error
        }

        return res.status(200).json({
            success: true,
            message: 'Password has been reset successfully'
        });

    } catch (error) {
        console.error('Reset password error:', error);

        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({
                success: false,
                message: 'Reset token has expired'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid reset token'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};
