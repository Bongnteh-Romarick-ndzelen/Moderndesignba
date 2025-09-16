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

/**
 * @swagger
 * tags:
 *   name: Contact
 *   description: Contact form management API
 */

/**
 * @swagger
 * /api/contact/submit:
 *   post:
 *     summary: Submit a contact form
 *     tags: [Contact]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 example: +237 652 467 599
 *               subject:
 *                 type: string
 *                 enum: ['', 'General Inquiry', 'Project Consultation', 'Partnership', 'Careers', 'Other']
 *                 example: Project Consultation
 *               message:
 *                 type: string
 *                 maxLength: 2000
 *                 example: I'm interested in discussing a construction project...
 *     responses:
 *       201:
 *         description: Contact form submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Message sent successfully! We will get back to you within 24 hours.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 507f1f77bcf86cd799439011
 *                     name:
 *                       type: string
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       example: john.doe@example.com
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.post('/submit', contactValidation, submitContactForm);

/**
 * @swagger
 * /api/contact:
 *   get:
 *     summary: Get all contact submissions (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, read, replied, archived]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of contact submissions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contact'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     total:
 *                       type: integer
 *                       example: 25
 *                     pages:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.get('/', protect, restrictTo('admin'), getContacts);

/**
 * @swagger
 * /api/contact/{id}:
 *   get:
 *     summary: Get a specific contact submission (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contact submission ID
 *     responses:
 *       200:
 *         description: Contact submission details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Contact'
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', protect, restrictTo('admin'), getContact);

/**
 * @swagger
 * /api/contact/{id}/status:
 *   put:
 *     summary: Update contact submission status (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contact submission ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [new, read, replied, archived]
 *                 example: read
 *     responses:
 *       200:
 *         description: Status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Contact status updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Invalid status value or ID
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id/status', protect, restrictTo('admin'), updateContactStatus);

/**
 * @swagger
 * /api/contact/{id}:
 *   delete:
 *     summary: Delete a contact submission (Admin only)
 *     tags: [Contact]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Contact submission ID
 *     responses:
 *       200:
 *         description: Contact deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Contact deleted successfully
 *       401:
 *         description: Unauthorized - Token missing or invalid
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Contact not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', protect, restrictTo('admin'), deleteContact);

/**
 * @swagger
 * components:
 *   schemas:
 *     Contact:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 507f1f77bcf86cd799439011
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           example: john.doe@example.com
 *         phone:
 *           type: string
 *           example: +237 652 467 599
 *         subject:
 *           type: string
 *           enum: ['', 'General Inquiry', 'Project Consultation', 'Partnership', 'Careers', 'Other']
 *           example: Project Consultation
 *         message:
 *           type: string
 *           example: I'm interested in discussing a construction project...
 *         status:
 *           type: string
 *           enum: [new, read, replied, archived]
 *           example: new
 *         ipAddress:
 *           type: string
 *           example: 192.168.1.1
 *         userAgent:
 *           type: string
 *           example: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-15T10:30:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-15T10:30:00.000Z
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

export default router;