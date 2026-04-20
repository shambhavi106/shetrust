const mongoose = require('mongoose');

const RatingSchema = new mongoose.Schema({
  locationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Location',
    required: true,
    index: true
  },
  // Anonymous user token fingerprint (hashed, never the raw token)
  userToken: { type: String, required: true, index: true },

  timeSlot: {
    type: String,
    enum: ['morning', 'afternoon', 'evening', 'night'],
    required: true
  },

  // Core rating factors (1–10 scale)
  lighting: { type: Number, required: true, min: 1, max: 10 },
  crowdBehavior: { type: Number, required: true, min: 1, max: 10 },
  policeVisibility: { type: Number, required: true, min: 1, max: 10 },
  incidentWeight: { type: Number, required: true, min: 0, max: 10 },

  // Computed STI for this submission (before TRS weighting)
  rawSTI: { type: Number },

  // Free-text comment (optional, for Phase 2 NLP)
  comment: { type: String, maxlength: 500, default: '' },

  // Quick tags the user can tick
  tags: [{
    type: String,
    enum: [
      'well_lit', 'poorly_lit', 'crowded', 'deserted',
      'police_present', 'no_security', 'harassment_witnessed',
      'felt_safe', 'felt_unsafe', 'good_infrastructure'
    ]
  }],

  // Trust Reliability Score at submission time (0–1)
  trsAtSubmission: { type: Number, default: 0.5 },

  // Whether this rating was included in STI computation
  isIncluded: { type: Boolean, default: true },

  // For future crime-report integration
  crimeReportRef: { type: String, default: null },

  // Geolocation at time of submission (optional)
  submittedAt: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }
  },

  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

// Prevent same user rating same location+slot more than once per day
RatingSchema.index(
  { locationId: 1, userToken: 1, timeSlot: 1, createdAt: 1 },
  { partialFilterExpression: { isIncluded: true } }
);

// Compute raw STI from factors
RatingSchema.pre('save', function(next) {
  // STI formula: 0.30L + 0.30C + 0.20P + 0.20(10-I)
  this.rawSTI = Math.round(
    (0.30 * this.lighting +
     0.30 * this.crowdBehavior +
     0.20 * this.policeVisibility +
     0.20 * (10 - this.incidentWeight)) * 10
  ) / 10;
  next();
});

module.exports = mongoose.model('Rating', RatingSchema);
