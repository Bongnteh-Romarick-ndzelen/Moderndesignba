import express from 'express';
import {
    submitContactForm,
    getContacts,
    getContact,
    updateContactStatus,
    deleteContact
} from '../../controllers/contact/contactController.js';
import { contactValidation } from '../../middleware/validation.js';
import { protect, restrictTo } from '../../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/submit', contactValidation, submitContactForm);

// Admin protected routes
router.get('/', protect, restrictTo('admin'), getContacts);
router.get('/:id', protect, restrictTo('admin'), getContact);
router.put('/:id/status', protect, restrictTo('admin'), updateContactStatus);
router.delete('/:id', protect, restrictTo('admin'), deleteContact);

export default router;