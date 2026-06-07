const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String, required: [true,'Name is required'],
    trim: true, minlength: [2,'Min 2 chars'], maxlength: [50,'Max 50 chars'],
  },
  email: {
    type: String, required: [true,'Email is required'],
    unique: true, lowercase: true, trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
  },
  password: { type: String, required: true, minlength: [6,'Min 6 chars'], select: false },
  avatar:         { type: String, default: null },
  anonTokenHash:  { type: String, default: null },
  isVerified:     { type: Boolean, default: false },
  role:           { type: String, enum: ['user','moderator','admin'], default: 'user' },
  lastLogin:      { type: Date, default: null },

  // ── Push notification subscription (Web Push VAPID) ────────────────
  pushSubscription: {
    endpoint: { type: String, default: null },
    keys: {
      p256dh: { type: String, default: null },
      auth:   { type: String, default: null },
    },
  },

  // ── Notification preferences ────────────────────────────────────────
  notifPrefs: {
    pushEnabled:   { type: Boolean, default: false },
    emailEnabled:  { type: Boolean, default: false },
    // Alert when a rated location drops below 'moderate'
    stiDropAlerts: { type: Boolean, default: true },
    // Weekly area digest
    weeklyDigest:  { type: Boolean, default: true },
    // Real-time zone alerts (socket)
    zoneAlerts:    { type: Boolean, default: true },
    // Minimum STI threshold for personal alerts
    alertThreshold:{ type: Number, default: 5, min: 0, max: 10 },
  },

  // ── Rated location tracking (for personalised alerts) ──────────────
  // Denormalised list of location IDs the user has rated, for fast alert queries
  ratedLocationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }],

  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, await bcrypt.genSalt(12));
  next();
});
UserSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};
UserSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.anonTokenHash;
  delete obj.pushSubscription; // never expose keys to client
  return obj;
};

module.exports = mongoose.model('User', UserSchema);
