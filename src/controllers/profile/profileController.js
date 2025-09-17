import { validationResult, body } from 'express-validator';
import mongoose from 'mongoose';
import Profile from '../../models/Profile.js';
import User from '../../models/User.js';

// Validation middleware for profile creation
export const validateProfileCreation = [
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio cannot exceed 500 characters'),
    body('location')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Location cannot exceed 100 characters'),
    body('country')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Country cannot exceed 100 characters'),
    body('phoneNumber')
        .optional()
        .trim()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Please enter a valid phone number'),
    body('profileImage')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Profile image URL cannot exceed 500 characters')
];

// Validation middleware for profile update
export const validateProfileUpdate = [
    body('bio')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Bio cannot exceed 500 characters'),
    body('location')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Location cannot exceed 100 characters'),
    body('country')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage('Country cannot exceed 100 characters'),
    body('phoneNumber')
        .optional()
        .trim()
        .matches(/^\+?[1-9]\d{1,14}$/)
        .withMessage('Please enter a valid phone number'),
    body('profileImage')
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage('Profile image URL cannot exceed 500 characters')
];


export const createProfile = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { bio, location, country, phoneNumber, profileImage } = req.body;
        const userId = req.user._id;

        // Check if profile already exists
        const existingProfile = await Profile.findOne({ userId });
        if (existingProfile) {
            return res.status(400).json({
                success: false,
                message: 'Profile already exists for this user'
            });
        }

        const profile = new Profile({
            userId,
            bio,
            location,
            country,
            phoneNumber,
            profileImage
        });

        await profile.save();

        res.status(201).json({
            success: true,
            message: 'Profile created successfully',
            data: { profile }
        });
    } catch (error) {
        console.error('Error in createProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while creating profile',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
export const updateProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'admin';
        const isSelfUpdate = req.user._id.toString() === id;

        if (!isAdmin && !isSelfUpdate) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this profile'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { bio, location, country, phoneNumber, profileImage } = req.body;

        const profile = await Profile.findOneAndUpdate(
            { userId: id },
            { bio, location, country, phoneNumber, profileImage },
            { new: true, runValidators: true }
        );

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: { profile }
        });
    } catch (error) {
        console.error('Error in updateProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while updating profile',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};

export const getProfile = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const user = await User.findById(id).select('fullName email');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const profile = await Profile.findOne({ userId: id });

        const responseProfile = {
            userId: id,
            fullName: user.fullName,
            email: user.email,
            bio: profile ? profile.bio : '',
            location: profile ? profile.location : '',
            country: profile ? profile.country : '',
            phoneNumber: profile ? profile.phoneNumber : '',
            profileImage: profile ? profile.profileImage : '',
            createdAt: profile ? profile.createdAt : user.createdAt,
            updatedAt: profile ? profile.updatedAt : user.updatedAt
        };

        res.status(200).json({
            success: true,
            message: 'Profile retrieved successfully',
            data: { profile: responseProfile }
        });
    } catch (error) {
        console.error('Error in getProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while retrieving profile',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};
export const deleteProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'admin';
        const isSelfDelete = req.user._id.toString() === id;

        if (!isAdmin && !isSelfDelete) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this profile'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        const profile = await Profile.findOneAndDelete({ userId: id });

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: 'Profile not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile deleted successfully'
        });
    } catch (error) {
        console.error('Error in deleteProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while deleting profile',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
};