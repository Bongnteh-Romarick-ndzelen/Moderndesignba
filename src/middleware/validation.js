import { body } from 'express-validator';

export const contactValidation = [
    body('name')
        .trim()
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ max: 100 })
        .withMessage('Name cannot exceed 100 characters'),

    body('email')
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail(),

    body('phone')
        .optional()
        .isLength({ max: 20 })
        .withMessage('Phone number cannot exceed 20 characters')
        .matches(/^[+]?[0-9\s\-()]+$/)
        .withMessage('Please enter a valid phone number'),

    body('subject')
        .optional()
        .isIn(['', 'General Inquiry', 'Project Consultation', 'Partnership', 'Careers', 'Other'])
        .withMessage('Invalid subject'),

    body('message')
        .trim()
        .notEmpty()
        .withMessage('Message is required')
        .isLength({ max: 2000 })
        .withMessage('Message cannot exceed 2000 characters')
];