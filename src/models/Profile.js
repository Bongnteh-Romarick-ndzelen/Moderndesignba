import mongoose from 'mongoose';

const ProfileSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        unique: true
    },
    bio: {
        type: String,
        trim: true,
        maxlength: [500, 'Bio cannot exceed 500 characters'],
        default: ''
    },
    location: {
        type: String,
        trim: true,
        maxlength: [100, 'Location cannot exceed 100 characters'],
        default: ''
    },
    country: {
        type: String,
        trim: true,
        maxlength: [100, 'Country cannot exceed 100 characters'],
        default: ''
    },
    phoneNumber: {
        type: String,
        trim: true,
        match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number'],
        default: ''
    },
    profileImage: {
        type: String,
        trim: true,
        maxlength: [500, 'Profile image URL cannot exceed 500 characters'],
        default: ''
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        }
    }
});

// Pre-save hook to validate userId
ProfileSchema.pre('save', async function (next) {
    try {
        const user = await mongoose.model('User').findById(this.userId);
        if (!user) {
            return next(new Error('Invalid user ID'));
        }
        next();
    } catch (error) {
        console.error(`Error validating userId: ${error.message}`);
        next(error);
    }
});

// Index
ProfileSchema.index({ userId: 1 });

export default mongoose.model('Profile', ProfileSchema);