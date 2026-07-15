// Slide duration config shared between Remotion (video rendering, see
// src/remotion/VideoSequence.jsx) and Gemini (script building, see src/script-builder.js) — kept
// in one place so the two stay in sync if the reading speed changes later.
const FPS = 30;

// Average skim-reading speed (words/second) — used to compute each slide's duration based on the
// ACTUAL quote length (see durationInFramesForText below): longer quotes stay on screen longer,
// shorter ones move faster, always just enough to skim-read comfortably, not too slow or fast.
const READING_WORDS_PER_SECOND = 3;

// Upper/lower bounds to avoid a slide that's too short (not enough time to read, even for a very
// short quote) or too long (video drags, even for a very long quote).
const MIN_QUOTE_DURATION_SECONDS = 3;
const MAX_QUOTE_DURATION_SECONDS = 8;
// The first quote/segment (title/hook) stays on screen a bit longer than the text-based
// calculation, since the font is bigger and viewers need a moment to settle into the video.
const TITLE_EXTRA_SECONDS = 1;

// REFERENCE durations (not used for actual rendering) — only used by script-builder.js to
// estimate a max word count for self-written connector sentences when building a script
// (Milestone 4b), separate from the real per-slide duration in a regular 1-quote-1-slide video
// (already computed dynamically from text in durationInFramesForText).
const REFERENCE_TITLE_DURATION_SECONDS = 5;
const REFERENCE_QUOTE_DURATION_SECONDS = 4;

function wordCount(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// Computes how many frames to show 1 slide for, based on the actual quote length (word count
// divided by average reading speed), clamped to the bounds above so it's never too short/long.
function durationInFramesForText(text, { isTitle = false } = {}) {
  const seconds = wordCount(text) / READING_WORDS_PER_SECOND + (isTitle ? TITLE_EXTRA_SECONDS : 0);
  const clamped = Math.min(Math.max(seconds, MIN_QUOTE_DURATION_SECONDS), MAX_QUOTE_DURATION_SECONDS);
  return Math.round(clamped * FPS);
}

module.exports = {
  FPS,
  READING_WORDS_PER_SECOND,
  MIN_QUOTE_DURATION_SECONDS,
  MAX_QUOTE_DURATION_SECONDS,
  REFERENCE_TITLE_DURATION_SECONDS,
  REFERENCE_QUOTE_DURATION_SECONDS,
  durationInFramesForText,
};
