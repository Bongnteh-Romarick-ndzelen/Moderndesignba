import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    phone: {
        type: String,
        trim: true,
        maxlength: [20, 'Phone number cannot exceed 20 characters']
    },
    subject: {
        type: String,
        enum: ['', 'General Inquiry', 'Project Consultation', 'Partnership', 'Careers', 'Other'],
        default: ''
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        maxlength: [2000, 'Message cannot exceed 2000 characters']
    },
    status: {
        type: String,
        enum: ['new', 'read', 'replied', 'archived'],
        default: 'new'
    },
    ipAddress: {
        type: String,
        default: ''
    },
    userAgent: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index for better query performance
contactSchema.index({ email: 1, createdAt: -1 });
contactSchema.index({ status: 1 });

export default mongoose.model('Contact', contactSchema);