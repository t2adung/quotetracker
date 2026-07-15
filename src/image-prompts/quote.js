// Image style for the "quote" topic — used for the current quote-extraction video.
// Kept as short phrases (not full sentences) to reduce input tokens per call, while still
// covering the required constraints: 1 single cohesive photo (not a 2-half collage or
// separate solid-color blocks), Asian person (ideally Vietnamese) occupying only about 1/4
// of the frame rather than being cropped down to a small sliver, bright pastel tones, no
// text inserted into the image.
const STYLE_PROMPT_SUFFIX = `Style: cinematic photo, bright soft pastel tones, minimal, airy, peaceful — 1 single cohesive real photograph filling the whole frame (NOT a collage, NOT split panels, NOT a separate flat solid-color block glued onto part of the frame).
Person (if shown): Asian, ideally Vietnamese, appearance and styling. Whole figure visible, small in the frame — occupying roughly 1/4 of the frame — not cropped by the frame edge, not just a hand/shoulder sliver. Shown from behind, from the side, or at a distance so the face is not clearly recognizable.
Any empty space for a future text overlay must come naturally from the scene itself (open sky, distant blurred background) — never as an artificial separate rectangle.
No text: absolutely no letters, words, numbers, captions, watermark, or typography anywhere in the image.`;

// A handful of "base scenes" centered on everyday real-life actions (cooking, painting,
// walking...) to randomly pick 1 that's shared across all images of a video — keeps all
// images in the same video on the same theme/setting/action instead of scattering them
// across unrelated places.
const SCENE_ANCHORS = [
  'cooking a simple meal in a bright pastel-toned kitchen',
  'painting on a canvas outdoors in a pastel-lit garden',
  'walking along a scenic pastel-colored trail in nature',
  'arranging fresh flowers at a pastel-toned table',
  'brewing tea by a large window with soft pastel light',
  'tending potted plants on a sunny pastel balcony',
];

module.exports = { styleSuffix: STYLE_PROMPT_SUFFIX, sceneAnchors: SCENE_ANCHORS };
