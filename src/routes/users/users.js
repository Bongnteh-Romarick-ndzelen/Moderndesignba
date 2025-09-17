import express from 'express';
import {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    updateUserStatus,
    bulkDeleteUsers,
    getUserStatistics,
    validateUserCreation,
    validateUserUpdate,
    validateUserRoleChange,
    changeUserRole
} from '../../controllers/users/usersControllers.js';
import { protect, restrictTo } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: User ID
 *         fullName:
 *           type: string
 *           description: Full name of the user
 *         email:
 *           type: string
 *           format: email
 *           description: Email address (unique)
 *         role:
 *           type: string
 *           enum: [student, admin, instructor]
 *           description: User role
 *           default: student
 *         isEmailVerified:
 *           type: boolean
 *           description: Email verification status
 *           default: false
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Account creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 *         emailVerificationToken:
 *           type: string
 *           description: Email verification token (admin view only)
 *         emailVerificationExpires:
 *           type: string
 *           format: date-time
 *           description: Email verification expiry (admin view only)
 *         passwordResetToken:
 *           type: string
 *           description: Password reset token (admin view only)
 *         passwordResetExpires:
 *           type: string
 *           format: date-time
 *           description: Password reset expiry (admin view only)
 *         hasPassword:
 *           type: boolean
 *           description: Indicates if user has password (admin view only)
 * 
 *   responses:
 *     UnauthorizedError:
 *       description: Access token is missing or invalid
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Access denied. No token provided."
 * 
 *     ForbiddenError:
 *       description: User does not have required permissions
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Access denied. Admin role required."
 * 
 *     ValidationError:
 *       description: Request validation failed
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               message:
 *                 type: string
 *                 example: "Validation failed"
 *               errors:
 *                 type: array
 *                 items:
 *                   type: object
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user account (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: Full name of the user
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *               password:
 *                 type: string
 *                 minLength: 5
 *                 description: Password (minimum 5 characters)
 *               role:
 *                 type: string
 *                 enum: [student, admin, instructor]
 *                 default: student
 *                 description: User role
 *               isEmailVerified:
 *                 type: boolean
 *                 default: false
 *                 description: Email verification status
 *           examples:
 *             student:
 *               summary: Create student user
 *               value:
 *                 fullName: "John Doe"
 *                 email: "john@example.com"
 *                 password: "securepassword123"
 *                 role: "student"
 *                 isEmailVerified: false
 *             instructor:
 *               summary: Create instructor user
 *               value:
 *                 fullName: "Jane Smith"
 *                 email: "jane@example.com"
 *                 password: "instructorpass456"
 *                 role: "instructor"
 *                 isEmailVerified: true
 *     responses:
 *       201:
 *         description: User created successfully
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
 *                   example: "User created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Server error
 */
router.post('/', protect, restrictTo('admin'), validateUserCreation, createUser);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve all users with filtering and pagination (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of users per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [student, admin, instructor]
 *         description: Filter by user role
 *       - in: query
 *         name: isEmailVerified
 *         schema:
 *           type: boolean
 *         description: Filter by email verification status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         verifiedUsers:
 *                           type: integer
 *                         students:
 *                           type: integer
 *                         instructors:
 *                           type: integer
 *                         admins:
 *                           type: integer
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalUsers:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 *                         hasPrev:
 *                           type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Server error
 */
router.get('/', protect, restrictTo('admin'), getUsers);

/**
 * @swagger
 * /api/users/statistics:
 *   get:
 *     summary: Get user statistics
 *     description: Get comprehensive user statistics and analytics (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalUsers:
 *                           type: integer
 *                         verifiedUsers:
 *                           type: integer
 *                         unverifiedUsers:
 *                           type: integer
 *                         students:
 *                           type: integer
 *                         instructors:
 *                           type: integer
 *                         admins:
 *                           type: integer
 *                     registrationTrends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: object
 *                             properties:
 *                               year:
 *                                 type: integer
 *                               month:
 *                                 type: integer
 *                               day:
 *                                 type: integer
 *                           count:
 *                             type: integer
 *                     verificationRate:
 *                       type: number
 *                       description: Email verification rate percentage
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Server error
 */
router.get('/statistics', protect, restrictTo('admin'), getUserStatistics);

/**
 * @swagger
 * /api/users/bulk-delete:
 *   delete:
 *     summary: Bulk delete users
 *     description: Delete multiple users at once (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of user IDs to delete
 *           example:
 *             userIds: ["64f8b4a8d1234567890abcde", "64f8b4a8d1234567890abcdf"]
 *     responses:
 *       200:
 *         description: Users deleted successfully
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
 *                   example: "2 users deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedCount:
 *                       type: integer
 *                     deletedUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           fullName:
 *                             type: string
 *                           email:
 *                             type: string
 *                           role:
 *                             type: string
 *       400:
 *         description: Invalid request or trying to delete own account
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Server error
 */
router.delete('/bulk-delete', protect, restrictTo('admin'), bulkDeleteUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a specific user with all fields including sensitive data (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid user ID
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get('/:id', protect, restrictTo('admin'), getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Update user
 *     description: Update user information (Admin or self-update)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 description: Full name of the user
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address
 *               password:
 *                 type: string
 *                 minLength: 5
 *                 description: New password (minimum 5 characters)
 *               role:
 *                 type: string
 *                 enum: [student, admin, instructor]
 *                 description: User role (Admin only)
 *               isEmailVerified:
 *                 type: boolean
 *                 description: Email verification status (Admin only)
 *           examples:
 *             self_update:
 *               summary: Self profile update
 *               value:
 *                 fullName: "John Smith"
 *                 email: "john.smith@example.com"
 *                 password: "newpassword123"
 *             admin_update:
 *               summary: Admin user update
 *               value:
 *                 fullName: "Jane Doe"
 *                 email: "jane.doe@example.com"
 *                 role: "instructor"
 *                 isEmailVerified: true
 *     responses:
 *       200:
 *         description: User updated successfully
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
 *                   example: "User updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid user ID or validation error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Not authorized to update this user
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.patch('/:id', protect, validateUserUpdate, updateUser);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Delete a specific user (Admin only, cannot delete self)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *                   example: "User deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     deletedUser:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *       400:
 *         description: Invalid user ID or trying to delete own account
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', protect, restrictTo('admin'), deleteUser);

/**
 * @swagger
 * /api/users/{id}/status:
 *   patch:
 *     summary: Update user status
 *     description: Update user email verification status (Admin only)
 *     tags: [User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isEmailVerified
 *             properties:
 *               isEmailVerified:
 *                 type: boolean
 *                 description: Email verification status
 *           example:
 *             isEmailVerified: true
 *     responses:
 *       200:
 *         description: User status updated successfully
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
 *                   example: "User email verification status updated to verified"
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     oldStatus:
 *                       type: boolean
 *                     newStatus:
 *                       type: boolean
 *       400:
 *         description: Invalid user ID or request data
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.patch('/:id/status', protect, restrictTo('admin'), updateUserStatus);

/**
 * @swagger
 * /api/users/{id}/role:
 *   patch:
 *     summary: Change a user's role
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: ['user', 'admin']
 *                 description: The new role for the user
 *                 example: admin
 *     responses:
 *       200:
 *         description: User role changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid user ID, role, or attempt to change own role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 */
router.patch('/:id/role', protect, restrictTo('admin'), validateUserRoleChange, changeUserRole);


export default router;