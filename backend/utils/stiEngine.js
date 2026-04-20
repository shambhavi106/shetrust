/**
 * STI Computation Engine
 * Computes the Safety Trust Index for a location+timeslot
 * using trust-weighted aggregation.
 */

const Rating = require('../models/Rating');
const UserTrust = require('../models/UserTrust');
const Location = require('../models/Location');

const MIN_VOTES_TO_PUBLISH = 3; // minimum ratings before STI is shown

/**
 * Compute STI for a specific location + time slot.
 * Called after every new rating submission.
 */
async function computeSTI(locationId, timeSlot) {
  // Fetch all included ratings for this location+slot
  const ratings = await Rating.find({
    locationId,
    timeSlot,
    isIncluded: true
  }).lean();

  if (ratings.length < MIN_VOTES_TO_PUBLISH) {
    return {
      sti: null,
      category: 'unrated',
      ratingCount: ratings.length,
      avgLighting: null,
      avgCrowd: null,
      avgPolice: null,
      avgIncident: null,
      needsMoreVotes: true
    };
  }

  // Fetch TRS for each user
  const tokenHashes = [...new Set(ratings.map(r => r.userToken))];
  const trustScores = await UserTrust.find({ tokenHash: { $in: tokenHashes } }).lean();
  const trsMap = Object.fromEntries(trustScores.map(t => [t.tokenHash, t.trs]));

  // Weighted aggregation
  let wSum = 0;
  let wLighting = 0, wCrowd = 0, wPolice = 0, wIncident = 0;

  for (const r of ratings) {
    const trs = trsMap[r.userToken] ?? 0.5; // default neutral if not found
    wSum += trs;
    wLighting += trs * r.lighting;
    wCrowd += trs * r.crowdBehavior;
    wPolice += trs * r.policeVisibility;
    wIncident += trs * r.incidentWeight;
  }

  if (wSum === 0) wSum = 1; // safety guard

  const avgL = wLighting / wSum;
  const avgC = wCrowd / wSum;
  const avgP = wPolice / wSum;
  const avgI = wIncident / wSum;

  // STI formula: 0.30L + 0.30C + 0.20P + 0.20(10-I)
  const sti = Math.round(
    (0.30 * avgL + 0.30 * avgC + 0.20 * avgP + 0.20 * (10 - avgI)) * 10
  ) / 10;

  const category = Location.schema.statics
    ? categorize(sti)
    : categorize(sti);

  return {
    sti,
    category,
    ratingCount: ratings.length,
    avgLighting: Math.round(avgL * 10) / 10,
    avgCrowd: Math.round(avgC * 10) / 10,
    avgPolice: Math.round(avgP * 10) / 10,
    avgIncident: Math.round(avgI * 10) / 10,
    needsMoreVotes: false
  };
}

function categorize(sti) {
  if (sti >= 8) return 'safe';
  if (sti >= 5) return 'moderate';
  return 'risky';
}

/**
 * After a new rating, update the location's time-slot STI and overall.
 */
async function updateLocationSTI(locationId, timeSlot) {
  const result = await computeSTI(locationId, timeSlot);
  const location = await Location.findById(locationId);
  if (!location) return;

  const slotIdx = location.timeSlots.findIndex(s => s.slot === timeSlot);
  if (slotIdx === -1) return;

  if (!result.needsMoreVotes) {
    location.timeSlots[slotIdx].sti = result.sti;
    location.timeSlots[slotIdx].category = result.category;
    location.timeSlots[slotIdx].lastUpdated = new Date();
  }
  location.timeSlots[slotIdx].ratingCount = result.ratingCount;
  location.timeSlots[slotIdx].avgLighting = result.avgLighting;
  location.timeSlots[slotIdx].avgCrowd = result.avgCrowd;
  location.timeSlots[slotIdx].avgPolice = result.avgPolice;
  location.timeSlots[slotIdx].avgIncident = result.avgIncident;

  location.totalRatings = location.timeSlots.reduce((s, sl) => s + (sl.ratingCount || 0), 0);
  location.recomputeOverall();
  await location.save();

  return result;
}

/**
 * After a rating, update the user's TRS based on how their rating
 * compares to the current consensus for that location+slot.
 */
async function updateUserTRS(userToken, locationId, timeSlot, userRawSTI) {
  const location = await Location.findById(locationId).lean();
  if (!location) return;

  const slot = location.timeSlots?.find(s => s.slot === timeSlot);
  const consensusSTI = slot?.sti ?? null;

  let userTrust = await UserTrust.findOne({ tokenHash: userToken });
  if (!userTrust) {
    userTrust = new UserTrust({ tokenHash: userToken });
  }

  userTrust.totalRatings += 1;
  userTrust.lastActivity = new Date();

  if (consensusSTI !== null) {
    const deviation = Math.abs(userRawSTI - consensusSTI);
    if (deviation <= 2) {
      // Within ±2 of consensus — counts as a match
      userTrust.consensusMatches += 1;
    } else if (deviation > 4) {
      userTrust.flaggedRatings += 1;
    }
  } else {
    // No consensus yet — treat as neutral match
    userTrust.consensusMatches += 1;
  }

  userTrust.recomputeTRS();
  await userTrust.save();

  return userTrust.trs;
}

module.exports = { computeSTI, updateLocationSTI, updateUserTRS, categorize };
