import Contact from '../../models/Contact.js';
import { validationResult } from 'express-validator';
import nodemailer from 'nodemailer';

// Configure email transporter (update with your SMTP settings)
const transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

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

        // Send email notification (optional)
        try {
            const mailOptions = {
                from: process.env.EMAIL_HOST || 'noreply@constructionco.com',
                to: process.env.EMAIL_USER || 'contact@constructionco.com',
                subject: `New Contact Form: ${subject || 'General Inquiry'}`,
                html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                <p><strong>Subject:</strong> ${subject || 'Not specified'}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
                <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                `
            };

            await transporter.sendMail(mailOptions);
        } catch (emailError) {
            console.error('Email notification failed:', emailError);
            // Don't fail the request if email fails
        }

        res.status(201).json({
            success: true,
            message: 'Message sent successfully! We will get back to you within 24 hours.',
            data: {
                id: newContact._id,
                name: newContact.name,
                email: newContact.email
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