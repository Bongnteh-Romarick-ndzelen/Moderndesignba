import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MODERN DESIGN API Documentation',
            version: '1.0.0',
            description:
                'Modern design',
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
                        _id: { type: 'string' },
                        fullName: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', enum: ['admin', 'user'] },
                        createdAt: { type: 'string', format: 'date-time' },
                    }
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ['./src/routes/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;