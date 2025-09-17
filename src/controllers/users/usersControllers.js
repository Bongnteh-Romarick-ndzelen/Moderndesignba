import User from '../../models/User.js';
import { validationResult, body } from 'express-validator';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Validation middleware for user creation
export const validateUserCreation = [
    body('fullName')
        .trim()
        .notEmpty()
        .withMessage('Full name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Full name must be between 2 and 50 characters'),
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 5 })
        .withMessage('Password must be at least 5 characters long'),
    body('role')
        .optional()
        .isIn(['student', 'admin', 'instructor'])
        .withMessage('Invalid role'),
    body('isEmailVerified')
        .optional()
        .isBoolean()
        .withMessage('Email verification status must be a boolean')
];

// Validation middleware for user update
export const validateUserUpdate = [
    body('fullName')
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Full name must be between 2 and 50 characters'),
    body('email')
        .optional()
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    body('password')
        .optional()
        .isLength({ min: 5 })
        .withMessage('Password must be at least 5 characters long'),
    body('role')
        .optional()
        .isIn(['student', 'admin', 'instructor'])
        .withMessage('Invalid role'),
    body('isEmailVerified')
        .optional()
        .isBoolean()
        .withMessage('Email verification status must be a boolean')
];

// Create a new user (Admin only)
export const createUser = async (req, res) => {
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

        const {
            fullName,
            email,
            password,
            role = 'student',
            isEmailVerified = false
        } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create new user
        const user = new User({
            fullName,
            email,
            password: hashedPassword,
            role,
            isEmailVerified
        });

        await user.save();

        // Get user without password for response
        const userResponse = await User.findById(user._id);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                user: userResponse
            }
        });

    } catch (error) {
        console.error('Error in createUser:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get all users with filtering and pagination
export const getUsers = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            role,
            isEmailVerified,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Build filter
        const filter = {};

        if (role) {
            filter.role = role;
        }

        if (isEmailVerified !== undefined) {
            filter.isEmailVerified = isEmailVerified === 'true';
        }

        // Add search functionality
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get users
        const users = await User.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-password -emailVerificationToken -passwordResetToken')
            .lean();

        // Get total count for pagination
        const totalUsers = await User.countDocuments(filter);

        // Calculate statistics
        const stats = await User.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    verifiedUsers: {
                        $sum: { $cond: ['$isEmailVerified', 1, 0] }
                    },
                    students: {
                        $sum: { $cond: [{ $eq: ['$role', 'student'] }, 1, 0] }
                    },
                    instructors: {
                        $sum: { $cond: [{ $eq: ['$role', 'instructor'] }, 1, 0] }
                    },
                    admins: {
                        $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
                    }
                }
            }
        ]);

        const statistics = stats[0] || {
            totalUsers: 0,
            verifiedUsers: 0,
            students: 0,
            instructors: 0,
            admins: 0
        };

        res.status(200).json({
            success: true,
            data: {
                users,
                statistics,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalUsers / limit),
                    totalUsers,
                    limit: parseInt(limit),
                    hasNext: page < Math.ceil(totalUsers / limit),
                    hasPrev: page > 1
                }
            }
        });

    } catch (error) {
        console.error('Error in getUsers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching users',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};


// Get user by ID with all fields (Admin only)
export const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Get user with all fields including sensitive ones (admin only)
        const user = await User.findById(id).select('+password +emailVerificationToken +emailVerificationExpires +passwordResetToken +passwordResetExpires');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Remove the actual password value but keep the field indicator
        const userResponse = user.toObject();
        userResponse.hasPassword = !!userResponse.password;
        delete userResponse.password;

        res.status(200).json({
            success: true,
            data: {
                user: userResponse
            }
        });

    } catch (error) {
        console.error('Error in getUserById:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update user (Admin or self-update)
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'admin';
        const isSelfUpdate = req.user.id === id;

        // Check authorization
        if (!isAdmin && !isSelfUpdate) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this user'
            });
        }

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const {
            fullName,
            email,
            password,
            role,
            isEmailVerified
        } = req.body;

        // Restrict certain fields for self-update
        if (isSelfUpdate && !isAdmin) {
            if (role && role !== user.role) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot change your own role'
                });
            }
            if (isEmailVerified !== undefined && isEmailVerified !== user.isEmailVerified) {
                return res.status(403).json({
                    success: false,
                    message: 'Cannot change email verification status'
                });
            }
        }

        // Check if email is being changed and if it already exists
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email, _id: { $ne: id } });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
            user.email = email;
            // Reset email verification if email is changed
            if (isAdmin || isSelfUpdate) {
                user.isEmailVerified = false;
                user.emailVerificationToken = undefined;
                user.emailVerificationExpires = undefined;
            }
        }

        // Update fields
        if (fullName) user.fullName = fullName;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(password, salt);
        }
        if (role && isAdmin) user.role = role;
        if (isEmailVerified !== undefined && isAdmin) user.isEmailVerified = isEmailVerified;

        await user.save();

        // Get updated user without sensitive fields
        const updatedUser = await User.findById(id);

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: {
                user: updatedUser
            }
        });

    } catch (error) {
        console.error('Error in updateUser:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Delete user (Admin only)
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Prevent admin from deleting themselves
        if (req.user.id === id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Store user info for response
        const deletedUserInfo = {
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role
        };

        await User.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'User deleted successfully',
            data: {
                deletedUser: deletedUserInfo
            }
        });

    } catch (error) {
        console.error('Error in deleteUser:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting user',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Update user status (Admin only)
export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isEmailVerified } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        if (typeof isEmailVerified !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Email verification status must be a boolean'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const oldStatus = user.isEmailVerified;
        user.isEmailVerified = isEmailVerified;

        // Clear verification tokens if manually verifying
        if (isEmailVerified) {
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: `User email verification status updated to ${isEmailVerified ? 'verified' : 'unverified'}`,
            data: {
                userId: user._id,
                fullName: user.fullName,
                email: user.email,
                oldStatus,
                newStatus: isEmailVerified
            }
        });

    } catch (error) {
        console.error('Error in updateUserStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating user status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Bulk operations (Admin only)
export const bulkDeleteUsers = async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs array is required'
            });
        }

        // Validate all IDs
        const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user IDs found',
                invalidIds
            });
        }

        // Prevent admin from deleting themselves
        if (userIds.includes(req.user.id)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        // Get users info before deletion
        const usersToDelete = await User.find({ _id: { $in: userIds } })
            .select('fullName email role');

        // Delete users
        const result = await User.deleteMany({ _id: { $in: userIds } });

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} users deleted successfully`,
            data: {
                deletedCount: result.deletedCount,
                deletedUsers: usersToDelete
            }
        });

    } catch (error) {
        console.error('Error in bulkDeleteUsers:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting users',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

// Get user statistics (Admin only)
export const getUserStatistics = async (req, res) => {
    try {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    verifiedUsers: {
                        $sum: { $cond: ['$isEmailVerified', 1, 0] }
                    },
                    unverifiedUsers: {
                        $sum: { $cond: ['$isEmailVerified', 0, 1] }
                    },
                    students: {
                        $sum: { $cond: [{ $eq: ['$role', 'student'] }, 1, 0] }
                    },
                    instructors: {
                        $sum: { $cond: [{ $eq: ['$role', 'instructor'] }, 1, 0] }
                    },
                    admins: {
                        $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
                    }
                }
            }
        ]);

        // Get registration trends (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const registrationTrends = await User.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const statistics = stats[0] || {
            totalUsers: 0,
            verifiedUsers: 0,
            unverifiedUsers: 0,
            students: 0,
            instructors: 0,
            admins: 0
        };

        res.status(200).json({
            success: true,
            data: {
                overview: statistics,
                registrationTrends,
                verificationRate: statistics.totalUsers > 0
                    ? Math.round((statistics.verifiedUsers / statistics.totalUsers) * 100)
                    : 0
            }
        });

    } catch (error) {
        console.error('Error in getUserStatistics:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching user statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};