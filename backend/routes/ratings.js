const express = require('express');
const router = express.Router();
const Rating = require('../models/Rating');
const Location = require('../models/Location');
const { authMiddleware } = require('../middleware/auth');
const { updateLocationSTI, updateUserTRS } = require('../utils/stiEngine');
const { getIO } = require('../socket');

/**
 * POST /api/ratings
 * Submit an anonymous safety rating for a location+timeslot.
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      locationId, timeSlot,
      lighting, crowdBehavior, policeVisibility, incidentWeight,
      comment, tags
    } = req.body;

    // Validation
    if (!locationId || !timeSlot) {
      return res.status(400).json({ success: false, error: 'locationId and timeSlot are required' });
    }
    if (!['morning', 'afternoon', 'evening', 'night'].includes(timeSlot)) {
      return res.status(400).json({ success: false, error: 'Invalid timeSlot' });
    }
    const factors = { lighting, crowdBehavior, policeVisibility, incidentWeight };
    for (const [k, v] of Object.entries(factors)) {
      if (v === undefined || v === null || isNaN(v) || v < 0 || v > 10) {
        return res.status(400).json({ success: false, error: `${k} must be 0–10` });
      }
    }

    // Check location exists
    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({ success: false, error: 'Location not found' });
    }

    // Prevent same user submitting same slot twice within 6 hours
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recentRating = await Rating.findOne({
      locationId,
      userToken: req.userToken,
      timeSlot,
      createdAt: { $gte: sixHoursAgo }
    });
    if (recentRating) {
      return res.status(429).json({
        success: false,
        error: 'You already rated this location for this time slot recently. Try again in 6 hours.'
      });
    }

    // Create rating
    const rating = new Rating({
      locationId,
      userToken: req.userToken,
      timeSlot,
      lighting: parseInt(lighting),
      crowdBehavior: parseInt(crowdBehavior),
      policeVisibility: parseInt(policeVisibility),
      incidentWeight: parseInt(incidentWeight),
      comment: comment?.slice(0, 500) || '',
      tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
      trsAtSubmission: 0.5
    });
    await rating.save();

    // Update STI and TRS asynchronously (don't block response)
    setImmediate(async () => {
      try {
        const stiResult = await updateLocationSTI(locationId, timeSlot);
        if (stiResult) {
          await updateUserTRS(req.userToken, locationId, timeSlot, rating.rawSTI);
          // Emit real-time heatmap update to all connected clients
          try {
            const io = getIO();
            const updatedLocation = await Location.findById(locationId).lean();
            io.emit('heatmap-update', {
              locationId,
              timeSlot,
              sti: stiResult.sti,
              category: stiResult.category,
              ratingCount: stiResult.ratingCount,
              location: updatedLocation,
            });
          } catch (socketErr) {
            // Socket not critical — log and continue
          }
        }
      } catch (e) {
        console.error('Async STI/TRS update error:', e);
      }
    });

    res.status(201).json({
      success: true,
      message: 'Rating submitted successfully',
      data: {
        ratingId: rating._id,
        rawSTI: rating.rawSTI,
        locationName: location.name,
        timeSlot,
        isNewToken: req.isNewToken || false
      }
    });
  } catch (err) {
    console.error('POST /ratings:', err);
    res.status(500).json({ success: false, error: 'Failed to submit rating' });
  }
});

/**
 * GET /api/ratings/location/:locationId
 * Get aggregated rating stats for a location (no individual user data).
 */
router.get('/location/:locationId', async (req, res) => {
  try {
    const { slot } = req.query;
    const query = { locationId: req.params.locationId, isIncluded: true };
    if (slot) query.timeSlot = slot;

    const ratings = await Rating.find(query)
      .select('timeSlot lighting crowdBehavior policeVisibility incidentWeight rawSTI tags createdAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Aggregate by slot
    const bySlot = {};
    for (const r of ratings) {
      if (!bySlot[r.timeSlot]) bySlot[r.timeSlot] = [];
      bySlot[r.timeSlot].push(r);
    }

    const summary = Object.entries(bySlot).map(([s, rs]) => ({
      slot: s,
      count: rs.length,
      avgSTI: Math.round((rs.reduce((a, r) => a + r.rawSTI, 0) / rs.length) * 10) / 10,
      avgLighting: Math.round((rs.reduce((a, r) => a + r.lighting, 0) / rs.length) * 10) / 10,
      avgCrowd: Math.round((rs.reduce((a, r) => a + r.crowdBehavior, 0) / rs.length) * 10) / 10,
      recentTags: rs.flatMap(r => r.tags).slice(0, 10)
    }));

    res.json({ success: true, data: { summary, recentCount: ratings.length } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch ratings' });
  }
});

/**
 * GET /api/ratings/my
 * Get ratings submitted by current anonymous user.
 */
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const ratings = await Rating.find({ userToken: req.userToken })
      .populate('locationId', 'name area')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, data: ratings, count: ratings.length });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch your ratings' });
  }
});

module.exports = router;
