// The screenshot the whole UI floats on.
//
// The game renders its menus over a blurred view of wherever you are standing,
// and that is what stops the cream rows from reading as a slab of yellow. So
// the app ships one: `public/backdrop.jpg`, a landscape from the game, blurred
// only slightly in CSS (see `.g-backdrop-photo` in index.css).
//
// To use your own, overwrite `public/backdrop.jpg` -- keep the name and it is
// picked up automatically. A remote URL works too, as long as the host allows
// hotlinking:
//
//   export const BACKDROP_IMAGE = 'https://example.com/genshin.jpg'
//
// Any landscape-ish image will do: it is blurred, so it does not need to be
// high resolution or free of UI elements. If the file is missing the app
// silently falls back to a painted gradient landscape (`.g-backdrop-mesh`), so
// nothing breaks.
export const BACKDROP_IMAGE = '/backdrop.jpg';
