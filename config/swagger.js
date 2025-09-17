import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MODERN DESIGN API Documentation',
            version: '1.0.0',
            description: 'Modern design API for user, contact, and profile management',
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Local development server'
            },
            {
                url: process.env.PRODUCTION_URL || 'https://moderndesign.onrender.com',
                description: 'Production server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', description: 'The user’s ID' },
                        fullName: { type: 'string', description: 'The user’s full name' },
                        email: { type: 'string', format: 'email', description: 'The user’s email address' },
                        role: { type: 'string', enum: ['admin', 'user'], description: 'The user’s role' },
                        createdAt: { type: 'string', format: 'date-time', description: 'User creation timestamp' },
                        updatedAt: { type: 'string', format: 'date-time', description: 'User update timestamp' }
                    }
                },
                Profile: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string', description: 'The ID of the associated user' },
                        bio: { type: 'string', description: 'User’s bio', maxLength: 500 },
                        location: { type: 'string', description: 'User’s location', maxLength: 100 },
                        country: { type: 'string', description: 'User’s country', maxLength: 100 },
                        phoneNumber: { type: 'string', description: 'User’s phone number' },
                        profileImage: { type: 'string', description: 'URL of the user’s profile image', maxLength: 500 },
                        createdAt: { type: 'string', format: 'date-time', description: 'Profile creation timestamp' },
                        updatedAt: { type: 'string', format: 'date-time', description: 'Profile update timestamp' }
                    }
                }
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./src/routes/**/*.js', './src/controllers/**/*.js', './src/models/swaggerSchemas.js'],
};

const swaggerSpec = swaggerJsdoc(options);
export default swaggerSpec;