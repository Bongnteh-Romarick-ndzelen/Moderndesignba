import dotenv from 'dotenv';
// Load environment variables specifically for this file
dotenv.config({ path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env' });

// Debug: Check if environment variables are loaded
console.log('Environment variables loaded:', {
    EMAIL_HOST: process.env.EMAIL_HOST ? 'Set' : 'Not set',
    EMAIL_USER: process.env.EMAIL_USER ? 'Set' : 'Not set',
    NODE_ENV: process.env.NODE_ENV
});

import Contact from '../../models/Contact.js';
import { validationResult } from 'express-validator';
import nodemailer from 'nodemailer';

// Email configuration with fallbacks
const createTransporter = () => {
    // If no SMTP config, return null (email will be skipped)
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.log('SMTP configuration not found. Email notifications disabled.');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.EMAIL_PORT || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false // For self-signed certificates
        }
    });
};

const sendEmailNotification = async (contactData) => {
    const transporter = createTransporter();

    if (!transporter) {
        console.log('Skipping email notification - no SMTP configuration');
        return { success: false, reason: 'no_smtp_config' };
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM || `"Construction Co" <${process.env.SMTP_USER}>`,
            to: process.env.EMAIL_USER || 'contact@constructionco.com',
            subject: `New Contact Form: ${contactData.subject || 'General Inquiry'}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">New Contact Form Submission</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #2563eb;">
            <p><strong>Name:</strong> ${contactData.name}</p>
            <p><strong>Email:</strong> ${contactData.email}</p>
            <p><strong>Phone:</strong> ${contactData.phone || 'Not provided'}</p>
            <p><strong>Subject:</strong> ${contactData.subject || 'Not specified'}</p>
            <p><strong>Message:</strong></p>
            <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e2e8f0;">
              ${contactData.message.replace(/\n/g, '<br>')}
            </div>
            <p style="margin-top: 15px; color: #64748b; font-size: 12px;">
              <strong>Submitted:</strong> ${new Date().toLocaleString()} | 
              <strong>IP:</strong> ${contactData.ipAddress}
            </p>
          </div>
        </div>
      `
        };

        await transporter.sendMail(mailOptions);
        console.log('Email notification sent successfully');
        return { success: true };
    } catch (error) {
        console.error('Email notification failed:', error.message);

        // Don't throw error, just return failure info
        return {
            success: false,
            reason: 'smtp_error',
            error: error.message
        };
    }
};

// Submit contact form
export const submitContactForm = async (req, res) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { name, email, phone, subject, message } = req.body;

        // Create new contact entry
        const newContact = new Contact({
            name,
            email,
            phone: phone || '',
            subject: subject || '',
            message,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent') || ''
        });

        await newContact.save();

        // Send email notification (non-blocking)
        const emailResult = await sendEmailNotification({
            name,
            email,
            phone,
            subject,
            message,
            ipAddress: newContact.ipAddress
        });

        // Log contact submission
        console.log('Contact form submitted:', {
            id: newContact._id,
            name,
            email,
            subject,
            emailSent: emailResult.success,
            emailError: emailResult.error
        });

        res.status(201).json({
            success: true,
            message: 'Message sent successfully! We will get back to you within 24 hours.',
            data: {
                id: newContact._id,
                name: newContact.name,
                email: newContact.email
            },
            notification: {
                emailSent: emailResult.success,
                ...(emailResult.success ? {} : { emailError: 'Email notification failed but message was saved' })
            }
        });

    } catch (error) {
        console.error('Contact form submission error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
};

// Get all contacts (admin only)
export const getContacts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const skip = (page - 1) * limit;

        const filter = {};
        if (status && ['new', 'read', 'replied', 'archived'].includes(status)) {
            filter.status = status;
        }

        const contacts = await Contact.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('-__v');

        const total = await Contact.countDocuments(filter);

        res.json({
            success: true,
            data: contacts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get single contact (admin only)
export const getContact = async (req, res) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            data: contact
        });

    } catch (error) {
        console.error('Get contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update contact status (admin only)
export const updateContactStatus = async (req, res) => {
    try {
        const { status } = req.body;

        if (!['new', 'read', 'replied', 'archived'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status value'
            });
        }

        const contact = await Contact.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            message: 'Contact status updated successfully',
            data: contact
        });

    } catch (error) {
        console.error('Update contact status error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Delete contact (admin only)
export const deleteContact = async (req, res) => {
    try {
        const contact = await Contact.findByIdAndDelete(req.params.id);

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            message: 'Contact deleted successfully'
        });

    } catch (error) {
        console.error('Delete contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};