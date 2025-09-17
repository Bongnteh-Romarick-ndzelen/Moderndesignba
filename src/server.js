import dotenv from 'dotenv';
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET', 'MONGO_URI', 'SESSION_SECRET', 'COOKIE_SECRET'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

console.log('Loaded ENV:', {
    JWT_SECRET: !!process.env.JWT_SECRET,
    MONGO_URI: !!process.env.MONGO_URI,
    SESSION_SECRET: !!process.env.SESSION_SECRET,
    COOKIE_SECRET: !!process.env.COOKIE_SECRET,
    CORS_ORIGINS: process.env.CORS_ORIGINS,
    NODE_ENV: process.env.NODE_ENV,
    COOKIE_SECURE: process.env.COOKIE_SECURE,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX
});

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import connectDB from '../config/db.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import compression from 'compression';
import morgan from 'morgan';
import net from 'net';
import mongoose from 'mongoose';

// Route imports
import authRoutes from './routes/auth/Auth.js';
import userRoutes from './routes/users/users.js';
import contactRoutes from './routes/contact/contactRoute.js';

import swaggerUi from 'swagger-ui-express';
import swaggerSpec from '../config/swagger.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== Cookie Domain Configuration =====
const getCookieDomain = () => {
    if (process.env.NODE_ENV === 'production') {
        // Use explicit domain if set, otherwise extract from FRONTEND_URL
        if (process.env.COOKIE_DOMAIN) {
            return process.env.COOKIE_DOMAIN;
        }
        if (process.env.FRONTEND_URL) {
            try {
                const url = new URL(process.env.FRONTEND_URL);
                return url.hostname;
            } catch (error) {
                console.warn('Invalid FRONTEND_URL, using default domain');
            }
        }
        // Default production domain
        return 'modern-design-zeta.vercel.app';
    }
    return 'localhost'; // Development
};

const cookieDomain = getCookieDomain();

// ===== Server Configuration =====
app.set('trust proxy', 1); // Needed for secure cookies in production

// ===== Database Connection =====
connectDB();

// ===== MongoDB Connection Health Check =====
setInterval(() => {
    const state = mongoose.connection.readyState;
    const states = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };

    if (state !== 1) {
        console.log(`⚠️ MongoDB connection state: ${states[state]}`);

        if (state === 0 && mongoose.connection._hasOpened) {
            console.log('Attempting to reconnect to MongoDB...');
            mongoose.connect(process.env.MONGO_URI).catch(err => {
                console.error('Reconnection failed:', err.message);
            });
        }
    }
}, 30000);

// ===== HTTPS Redirection (Production Only) =====
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
    });
}

// ===== Request Logging =====
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ===== Security Middleware =====
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'", ...(process.env.CORS_ORIGINS?.split(',') || [])],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    },
    hsts: {
        maxAge: 63072000,
        includeSubDomains: true,
        preload: true
    }
}));
app.use(mongoSanitize());
app.use(express.json({ limit: '10kb' }));
app.use(compression());

// ===== Rate Limiting =====
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'OPTIONS'
});
app.use('/api', limiter);

// ===== CORS Configuration =====
// Clean up the CORS_ORIGINS environment variable
const cleanOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

const allowedOrigins = cleanOrigins.length > 0 ? cleanOrigins : [
    'https://modern-design-zeta.vercel.app',
    'http://localhost:3000',
    'http://localhost:5000',
    'https://shielderabackend.onrender.com'
];

console.log('Cleaned allowed origins:', allowedOrigins);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        // Check if the origin is in the allowed list
        if (allowedOrigins.includes(origin) ||
            // Allow the Render domain itself for internal requests
            origin === 'https://shielderabackend.onrender.com') {
            return callback(null, true);
        }

        console.log('CORS blocked origin:', origin);
        console.log('Allowed origins:', allowedOrigins);

        // In development, be more permissive but still log the issue
        if (process.env.NODE_ENV === 'development') {
            console.log('Development mode: Allowing origin for debugging');
            return callback(null, true);
        }

        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['set-cookie'],
    optionsSuccessStatus: 200,
    maxAge: 600
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

// ===== Cookie & Session Configuration =====
app.use(cookieParser(process.env.COOKIE_SECRET));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        ttl: parseInt(process.env.SESSION_TTL) || 14 * 24 * 60 * 60
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true,
        path: '/',
        domain: cookieDomain,
        maxAge: parseInt(process.env.COOKIE_MAX_AGE) || 24 * 60 * 60 * 1000
    }
}));

// ===== Static Files =====
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// ===== API Routes =====
app.get('/', (req, res) => res.send('API Running'));
app.get('/health', (req, res) => res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    session: req.sessionID ? 'Active' : 'Inactive',
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
}));

// Protected API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/contact', contactRoutes);

// ===== Swagger Docs =====
// More permissive CORS for Swagger
app.use('/api-docs', (req, res, next) => {
    // Set permissive CORS headers specifically for Swagger
    const origin = req.headers.origin;

    // Allow if origin is in allowed list or if it's a direct request (no origin)
    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
}, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ===== Error Handling =====
app.use(errorHandler);

// ===== Port Check =====
const checkPort = (port) => new Promise((resolve) => {
    const tester = net.createServer()
        .once('error', () => resolve(false))
        .once('listening', () => {
            tester.close(() => resolve(true));
        })
        .listen(port);
});

// ===== Server Startup =====
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    const portAvailable = await checkPort(PORT);
    if (!portAvailable) {
        console.error(`Port ${PORT} is already in use`);
        process.exit(1);
    }

    const server = app.listen(PORT, () => {
        console.log(`\n🚀 Server started in ${process.env.NODE_ENV || 'development'} mode`);
        console.log(`📡 Listening on port ${PORT}`);
        console.log(`🌍 Allowed Origins: ${allowedOrigins.join(', ')}`);
        console.log(`🔒 Secure Cookies: ${process.env.NODE_ENV === 'production'}`);
        console.log(`🍪 Cookie Domain: ${cookieDomain}`);
        console.log(`🛡️ Session Store: MongoDB`);

        if (process.env.NODE_ENV !== 'production') {
            console.log(`📄 API Docs: http://localhost:${PORT}/api-docs`);
        }
    });

    // ===== Graceful Shutdown =====
    const shutdown = async (signal) => {
        console.log(`${signal} received. Shutting down gracefully...`);

        try {
            await new Promise((resolve) => server.close(resolve));
            console.log('HTTP server closed');

            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
                console.log('MongoDB connection closed');
            }

            process.exit(0);
        } catch (err) {
            console.error('Shutdown error:', err);
            process.exit(1);
        }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
        shutdown('uncaughtException');
    });
};

startServer().catch(err => {
    console.error('Server startup failed:', err);
    process.exit(1);
});