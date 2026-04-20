import React, { useState, useEffect, useCallback } from 'react';
import { useRating } from '../hooks/useRating';
import { useLocationSearch } from '../hooks/useLocations';
import STIRing from './STIRing';
import { TIME_SLOTS, locTypeIcon } from '../utils/helpers';
import { locationsApi } from '../utils/api';
import styles from './RateModal.module.css';

const QUICK_TAGS = [
  { key: 'well_lit',              label: '💡 Well lit',         cat: 'good' },
  { key: 'poorly_lit',            label: '🕯️ Poorly lit',       cat: 'bad'  },
  { key: 'felt_safe',             label: '😊 Felt safe',         cat: 'good' },
  { key: 'felt_unsafe',           label: '😰 Felt unsafe',       cat: 'bad'  },
  { key: 'crowded',               label: '👥 Crowded',           cat: 'neutral' },
  { key: 'deserted',              label: '🌑 Deserted',          cat: 'bad'  },
  { key: 'police_present',        label: '👮 Police present',    cat: 'good' },
  { key: 'no_security',           label: '❌ No security',       cat: 'bad'  },
  { key: 'harassment_witnessed',  label: '⚠️ Harassment seen',  cat: 'bad'  },
  { key: 'good_infrastructure',   label: '🏗️ Good infra',       cat: 'good' },
];

const FACTOR_CFG = [
  { key: 'lighting',         label: 'Street Lighting',      icon: '💡', hint: '1 = pitch dark · 10 = bright as day' },
  { key: 'crowdBehavior',    label: 'Crowd Behavior',        icon: '👥', hint: '1 = hostile/threatening · 10 = calm & safe' },
  { key: 'policeVisibility', label: 'Police / Security',     icon: '🚔', hint: '1 = no presence · 10 = strong presence' },
  { key: 'incidentWeight',   label: 'Incident Severity',     icon: '⚠️', hint: '0 = nothing happened · 10 = serious incident' },
];

export default function RateModal({ isOpen, onClose, prefillLocation, onRated }) {
  const [step, setStep]         = useState(1); // 1=location, 2=factors, 3=success
  const [location, setLocation] = useState(prefillLocation || null);
  const [newLocName, setNewLocName] = useState('');
  const [newLocMode, setNewLocMode] = useState(false);
  const [submitting2, setSubmitting2] = useState(false);

  const { query, setQuery, results, searching, clearResults } = useLocationSearch();

  const {
    factors, setFactor,
    timeSlot, setTimeSlot,
    comment, setComment,
    tags, toggleTag,
    previewSTI, previewCat,
    submitting, error, submitted,
    submit, reset,
  } = useRating({
    onSuccess: () => { setStep(3); onRated?.(); }
  });

  useEffect(() => {
    if (prefillLocation) { setLocation(prefillLocation); setStep(2); }
  }, [prefillLocation]);

  useEffect(() => {
    if (!isOpen) { setTimeout(() => { reset(); setStep(1); setLocation(null); setNewLocMode(false); }, 300); }
  }, [isOpen]);

  const selectLocation = (loc) => {
    setLocation(loc);
    setQuery('');
    clearResults();
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!location?._id) return;
    await submit(location._id);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>
              {step === 1 ? 'Choose a Location' : step === 2 ? 'Rate Safety Factors' : 'Thank You!'}
            </div>
            <div className={styles.modalSub}>
              {step === 1 && 'Search for a public space in Bengaluru'}
              {step === 2 && location && `${locTypeIcon(location.type)} ${location.name} · ${location.area}`}
              {step === 3 && 'Your anonymous rating has been recorded.'}
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        {step < 3 && (
          <div className={styles.steps}>
            {[1, 2].map(s => (
              <div key={s} className={`${styles.stepDot} ${step >= s ? styles.stepActive : ''}`}>
                {s < step ? '✓' : s}
              </div>
            ))}
            <div className={`${styles.stepLine} ${step >= 2 ? styles.stepLineFill : ''}`} />
          </div>
        )}

        {/* ── Step 1: Location search ───────────────────────── */}
        {step === 1 && (
          <div className={styles.body}>
            <input
              className="input"
              placeholder="Search: MG Road, Koramangala, Whitefield…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />

            {searching && <div className={styles.searching}>Searching…</div>}

            {results.length > 0 && (
              <div className={styles.results}>
                {results.map(loc => (
                  <button key={loc._id} className={styles.resultItem} onClick={() => selectLocation(loc)}>
                    <span>{locTypeIcon(loc.type)}</span>
                    <div>
                      <div className={styles.resultName}>{loc.name}</div>
                      <div className={styles.resultArea}>{loc.area}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {query.length < 2 && (
              <div className={styles.hint}>
                Type at least 2 characters to search. Can't find your location?{' '}
                <button className={styles.linkBtn} onClick={() => setNewLocMode(true)}>Add it</button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Rating factors ────────────────────────── */}
        {step === 2 && (
          <div className={styles.body}>
            {/* Time slot */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Time Slot</label>
              <div className={styles.slotGrid}>
                {TIME_SLOTS.map(ts => (
                  <button
                    key={ts.key}
                    className={`${styles.slotBtn} ${timeSlot === ts.key ? styles.slotActive : ''}`}
                    onClick={() => setTimeSlot(ts.key)}
                  >
                    <span className={styles.slotIcon}>{ts.icon}</span>
                    <span>{ts.label}</span>
                    <span className={styles.slotRange}>{ts.range}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            {FACTOR_CFG.map(f => (
              <div key={f.key} className={styles.fieldGroup}>
                <div className={styles.sliderHeader}>
                  <label className={styles.fieldLabel}>
                    {f.icon} {f.label}
                  </label>
                  <span className={styles.sliderVal}>{factors[f.key]}/10</span>
                </div>
                <input
                  type="range" min="0" max="10" step="1"
                  value={factors[f.key]}
                  onChange={e => setFactor(f.key, e.target.value)}
                />
                <div className={styles.sliderHint}>{f.hint}</div>
              </div>
            ))}

            {/* Quick tags */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Quick Tags (optional)</label>
              <div className={styles.tags}>
                {QUICK_TAGS.map(t => (
                  <button
                    key={t.key}
                    className={`${styles.tag} ${tags.includes(t.key) ? styles.tagActive : ''} ${styles[`tag_${t.cat}`]}`}
                    onClick={() => toggleTag(t.key)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Comment (optional, anonymous)</label>
              <textarea
                className={`input ${styles.textarea}`}
                placeholder="Anything else to share? E.g. Poorly lit after 8pm near the underpass"
                value={comment}
                onChange={e => setComment(e.target.value.slice(0, 500))}
                rows={3}
              />
              <div className={styles.charCount}>{comment.length}/500</div>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.submitRow}>
              <button className="btn btn-outline" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting}
                style={{ flex: 1 }}
              >
                {submitting ? '⏳ Submitting…' : '✓ Submit Anonymously'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Success ───────────────────────────────── */}
        {step === 3 && (
          <div className={`${styles.body} ${styles.successBody}`}>
            <STIRing sti={previewSTI} category={previewCat} size={120} />
            <div className={styles.successTitle}>Rating Submitted!</div>
            <div className={styles.successSub}>
              Your anonymous rating for <strong>{location?.name}</strong> has been recorded.
              The Safety Trust Index will update within moments.
            </div>
            <div className={styles.successNote}>
              🔒 No personal data was collected. Your identity remains private.
            </div>
            <button className="btn btn-primary" onClick={() => { reset(); setStep(1); setLocation(null); onClose(); }}>
              Rate Another Location
            </button>
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
