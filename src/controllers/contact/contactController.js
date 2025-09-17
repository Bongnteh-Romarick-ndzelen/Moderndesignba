import Contact from '../../models/Contact.js';
import { validationResult, body } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import User from '../../models/User.js';

// Load environment variables
dotenv.config();

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
        });

        // Additional Gmail-specific debugging
        if (config.host.includes('gmail') && !gmailFailed) {
            console.log('Gmail detected - ensure 2FA is enabled and app password is used without spaces');
        }
    }

    return nodemailer.createTransport(config);
};
// Validation middleware for admin reply
export const validateAdminReply = [
    body('message')
        .trim()
        .notEmpty()
        .withMessage('Reply message is required')
        .isLength({ max: 2000 })
        .withMessage('Reply message cannot exceed 2000 characters')
];

// Send contact form notification email
const sendContactNotificationEmail = async (contactData) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Modern Design and Construction Enterprise" <noreply@constructionco.com>',
            to: process.env.CONTACT_EMAIL || 'contact@constructionco.com',
            subject: `New Contact Form: ${contactData.subject || 'General Inquiry'}`,
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
                            .contact-details {
                                background: #f8fafc;
                                padding: 20px;
                                border-radius: 8px;
                                border-left: 4px solid #2563eb;
                                margin: 20px 0;
                            }
                            .contact-details p {
                                margin: 10px 0;
                            }
                            .message-container {
                                background: white;
                                padding: 15px;
                                border-radius: 4px;
                                border: 1px solid #e2e8f0;
                                margin: 20px 0;
                                font-size: 16px;
                                line-height: 1.6;
                            }
                            .footer {
                                text-align: center;
                                padding: 20px;
                                color: #999;
                                font-size: 13px;
                                border-top: 1px solid #eee;
                            }
                            .action-button {
                                display: inline-block;
                                background: linear-gradient(135deg, #0066ff 0%, #0033aa 100%);
                                color: white !important;
                                text-decoration: none;
                                padding: 12px 24px;
                                border-radius: 6px;
                                font-weight: 500;
                                font-size: 16px;
                                margin: 20px 0;
                                box-shadow: 0 4px 8px rgba(0, 102, 255, 0.2);
                            }
                            .meta-info {
                                color: #64748b;
                                font-size: 14px;
                                margin-top: 20px;
                                padding-top: 20px;
                                border-top: 1px solid #e2e8f0;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                NEW CONTACT FORM
                            </div>
                            
                            <div class="content">
                                <h2>New Contact Form Submission</h2>
                                
                                <div class="contact-details">
                                    <p><strong>Name:</strong> ${contactData.name}</p>
                                    <p><strong>Email:</strong> ${contactData.email}</p>
                                    ${contactData.phone ? `<p><strong>Phone:</strong> ${contactData.phone}</p>` : ''}
                                    ${contactData.subject ? `<p><strong>Subject:</strong> ${contactData.subject}</p>` : ''}
                                    <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
                                </div>
                                
                                <h3>Message:</h3>
                                <div class="message-container">
                                    ${contactData.message.replace(/\n/g, '<br>')}
                                </div>
                                
                                <div style="text-align: center;">
                                    <a href="mailto:${contactData.email}" class="action-button">Reply to ${contactData.name}</a>
                                </div>
                                
                                <div class="meta-info">
                                    <p><strong>IP Address:</strong> ${contactData.ipAddress}</p>
                                    <p><strong>User Agent:</strong> ${contactData.userAgent.substring(0, 50)}...</p>
                                </div>
                            </div>
                            
                            <div class="footer">
                                © ${new Date().getFullYear()} Construction Company. All rights reserved.<br>
                                <small>This is an automated notification from your website contact form.</small>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };

        // Add more detailed logging for debugging
        if (process.env.NODE_ENV === 'development') {
            console.log('Attempting to send contact notification email to:', process.env.CONTACT_EMAIL);
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Contact notification email sent: %s', info.messageId);

        // Log additional info in development
        if (process.env.NODE_ENV === 'development') {
            console.log('Contact email sent successfully to:', process.env.CONTACT_EMAIL);
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

        console.error('Error sending contact notification email:', error);
        throw error;
    }
};

// Send auto-reply to the person who submitted the form
const sendAutoReplyEmail = async (contactData) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.EMAIL_FROM || '"Construction Company" <noreply@constructionco.com>',
            to: contactData.email,
            subject: 'Thank you for contacting Construction Company',
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
                            .thank-you {
                                background: #f0f9ff;
                                padding: 20px;
                                border-radius: 8px;
                                border-left: 4px solid #0369a1;
                                margin: 20px 0;
                            }
                            .next-steps {
                                margin: 20px 0;
                            }
                            .next-steps li {
                                margin-bottom: 10px;
                            }
                            .contact-info {
                                background: #f8fafc;
                                padding: 20px;
                                border-radius: 8px;
                                margin: 20px 0;
                            }
                            .footer {
                                text-align: center;
                                padding: 20px;
                                color: #999;
                                font-size: 13px;
                                border-top: 1px solid #eee;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="email-container">
                            <div class="header">
                                THANK YOU
                            </div>
                            
                            <div class="content">
                                <h2>Thank You for Contacting Us!</h2>
                                
                                <div class="thank-you">
                                    <p>Hi ${contactData.name},</p>
                                    <p>Thank you for reaching out to Construction Company. We've received your message and will get back to you within 24 hours.</p>
                                </div>
                                
                                <h3>What happens next?</h3>
                                <ul class="next-steps">
                                    <li>Our team will review your inquiry</li>
                                    <li>We'll contact you to discuss your project</li>
                                    <li>You'll receive a personalized consultation</li>
                                </ul>
                                
                                <div class="contact-info">
                                    <p><strong>For immediate assistance:</strong></p>
                                    <p>📞 Phone: +237 652 467 599</p>
                                    <p>📧 Email: contact@constructionco.com</p>
                                    <p>🕒 Hours: Mon-Fri 8:00 AM - 5:00 PM</p>
                                </div>
                                
                                <p>We look forward to helping you with your construction needs!</p>
                                
                                <p>Best regards,<br>The Construction Company Team</p>
                            </div>
                            
                            <div class="footer">
                                © ${new Date().getFullYear()} Construction Company. All rights reserved.<br>
                                <small>123 Construction Avenue, Yaoundé, Cameroon</small>
                            </div>
                        </div>
                    </body>
                </html>
            `
        };

        if (process.env.NODE_ENV === 'development') {
            console.log('Attempting to send auto-reply email to:', contactData.email);
        }

        const info = await transporter.sendMail(mailOptions);
        console.log('Auto-reply email sent: %s', info.messageId);

        if (process.env.NODE_ENV === 'development') {
            console.log('Auto-reply email sent successfully to:', contactData.email);
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        console.error('Error sending auto-reply email:', error);
        // Don't throw error for auto-reply failures
        return null;
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

        // Send email notifications (non-blocking)
        try {
            // Send notification to admin
            const adminEmailResult = await sendContactNotificationEmail({
                name,
                email,
                phone,
                subject,
                message,
                ipAddress: newContact.ipAddress,
                userAgent: newContact.userAgent
            });

            // Send auto-reply to user
            const autoReplyResult = await sendAutoReplyEmail({
                name,
                email,
                subject
            });

            // Log email results
            console.log('Email results:', {
                adminNotification: adminEmailResult ? 'Success' : 'Failed',
                autoReply: autoReplyResult ? 'Success' : 'Failed'
            });

        } catch (emailError) {
            console.error('Email notification failed:', emailError.message);
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

export const sendAdminReply = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const adminName = req.user.fullName;
        const adminEmail = req.user.email;

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        // Validate contact ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact ID'
            });
        }

        // Check if contact exists
        const contact = await Contact.findById(id);
        if (!contact) {
            return res.status(404).json({
                success: false,
                message: 'Contact form submission not found'
            });
        }

        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to reply to contact submissions'
            });
        }

        // Configure nodemailer transport
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Email options
        const mailOptions = {
            from: `"${adminName}" <${adminEmail}>`,
            to: contact.email,
            subject: `Re: ${contact.subject || 'Your Contact Form Submission'}`,
            text: `
Dear ${contact.name},

Thank you for contacting us. Below is our response to your inquiry:

${message}

Best regards,
${adminName}
${adminEmail}
            `,
            html: `
<p>Dear ${contact.name},</p>
<p>Thank you for contacting us. Below is our response to your inquiry:</p>
<p>${message.replace(/\n/g, '<br>')}</p>
<p>Best regards,<br>${adminName}<br>${adminEmail}</p>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        // Update contact with admin response
        contact.adminResponse = {
            message,
            adminName,
            adminEmail,
            respondedAt: new Date()
        };
        contact.status = 'replied';
        await contact.save();

        res.status(200).json({
            success: true,
            message: 'Reply sent successfully',
            data: {
                contactId: contact._id,
                adminResponse: contact.adminResponse
            }
        });
    } catch (error) {
        console.error('Error in sendAdminReply:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while sending reply',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};