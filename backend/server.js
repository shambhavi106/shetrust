require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
require('dotenv').config();

const express   = require('express');
const http      = require('http');
const path      = require('path');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose  = require('mongoose');
const { initSocket } = require('./socket');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

const io = initSocket(server);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  exposedHeaders: ['X-Auth-Token'],
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded photos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const globalLimiter  = rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, message: { success: false, error: 'Too many requests.' } });
const ratingsLimiter = rateLimit({ windowMs: 60*60*1000, max: 20,  message: { success: false, error: 'Rating limit reached.' } });

app.use(globalLimiter);

app.use('/api/auth',          require('./routes/auth'));
app.use('/api/locations',     require('./routes/locations'));
app.use('/api/ratings',       ratingsLimiter, require('./routes/ratings'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/survey',        require('./routes/survey'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/incidents',     require('./routes/incidents'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok', service: 'SheTrust API', version: '2.1.0',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date(),
    features: ['dynamic-weights','network-availability','nlp-comments','sti-history',
               'notifications','push-alerts','incidents','photo-upload','admin'],
  });
});

app.use((req, res) => res.status(404).json({ success: false, error: `${req.method} ${req.path} not found` }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shetrust';
mongoose.connect(MONGO_URI).then(() => {
  console.log('✅ MongoDB connected');
  server.listen(PORT, () => {
    console.log(`\n🛡  SheTrust API v2.1 → http://localhost:${PORT}`);
    console.log(`🔔 Notifications, push alerts, incident reports: enabled`);
    console.log(`🧠 NLP sentiment → STI feedback: enabled\n`);
  });
}).catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('✅ MongoDB reconnected'));

module.exports = app;
