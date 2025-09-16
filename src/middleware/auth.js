import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ✅ Middleware to authenticate users
export const authenticate = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // Get user from the token (excluding password)
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Not authorized, user not found'
                });
            }
            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({
                success: false,
                message: 'Not authorized, invalid token'
            });
        }
    } else {
        return res.status(401).json({
            success: false,
            message: 'Not authorized, no token'
        });
    }
};

// Alias for compatibility with course creation routes
export const protect = authenticate;

// ✅ Generic role-based access control middleware
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        // roles is an array like ['admin', 'instructor', 'student']
        if (!roles.includes(req.user?.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};

// ✅ Specific role middleware functions
export const isInstructor = (req, res, next) => {
    if (req.user?.role !== 'instructor') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Instructor privileges required.'
        });
    }
    next();
};

export const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to perfome this action'
        });
    }
    next();
};

export const isStudent = (req, res, next) => {
    if (req.user?.role !== 'student') {
        return res.status(403).json({
            success: false,
            message: 'Only students are allowed to enroll for an internship!'
        });
    }
    next();
};

export const isAdminOrInstructor = (req, res, next) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'instructor') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin or instructor privileges required.'
        });
    }
    next();
};

// ✅ Additional utility middleware

// Optional middleware for routes that work with or without authentication
export const isLoggedIn = async (req, res, next) => {
    try {
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            const token = req.headers.authorization.split(' ')[1];

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const currentUser = await User.findById(decoded.id).select('-password');

                if (currentUser) {
                    req.user = currentUser;
                }
            } catch (error) {
                // Token invalid or expired, continue without user
                req.user = null;
            }
        }
        next();
    } catch (error) {
        req.user = null;
        next();
    }
};

// Middleware to check if user owns the resource
export const checkOwnership = (Model, paramName = 'id', ownerField = 'user') => {
    return async (req, res, next) => {
        try {
            const resourceId = req.params[paramName];
            const resource = await Model.findById(resourceId);

            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }

            // Check if user owns the resource or is admin
            const resourceOwnerId = resource[ownerField]?.toString() || resource[ownerField];
            const currentUserId = req.user.id || req.user._id.toString();

            if (resourceOwnerId !== currentUserId && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to access this resource'
                });
            }

            req.resource = resource;
            next();
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: 'Error checking resource ownership',
                error: error.message
            });
        }
    };
};

// Middleware to check if user can access course (instructor or enrolled student)
export const canAccessCourse = async (req, res, next) => {
    try {
        const courseId = req.params.courseId || req.params.id;
        const userId = req.user.id || req.user._id.toString();

        // Import models dynamically to avoid circular dependencies
        const Course = (await import('../models/Course.js')).default;
        const Enrollment = (await import('../models/Enrollment.js')).default;

        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                success: false,
                message: 'Course not found'
            });
        }

        // Check if user is instructor of the course
        if (course.instructor.toString() === userId) {
            req.course = course;
            req.userRole = 'instructor';
            return next();
        }

        // Check if user is admin
        if (req.user.role === 'admin') {
            req.course = course;
            req.userRole = 'admin';
            return next();
        }

        // Check if user is enrolled in the course
        const enrollment = await Enrollment.findOne({
            user: userId,
            course: courseId,
            status: 'active'
        });

        if (!enrollment) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this course'
            });
        }

        req.course = course;
        req.enrollment = enrollment;
        req.userRole = 'student';
        next();

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error checking course access',
            error: error.message
        });
    }
};