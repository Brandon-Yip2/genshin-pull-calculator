import { useState } from 'react';
import { BACKDROP_IMAGE } from './data/backdrop.js';

/**
 * The blurred, darkened landscape the whole UI floats on, mirroring how the
 * game renders its menus over a blurred screenshot of the world.
 *
 * Three stacked layers:
 *   1. a painted gradient landscape, used as a fallback;
 *   2. the screenshot of the world (`public/backdrop.jpg` by default), which
 *      covers the painting once it loads -- `onError` hides it silently, so a
 *      missing or renamed file just leaves the painting in place;
 *   3. the scrim the game puts over it, darkest at the top where the title bar
 *      sits and at the bottom, much lighter in the middle so the landscape
 *      genuinely reads through the translucent rows.
 *
 * The screenshot is blurred only slightly: enough to sit behind the UI, not
 * enough to turn the world into a coloured smear.
 *
 * All of it is decorative, so it is hidden from assistive tech.
 */
export default function Backdrop() {
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = Boolean(BACKDROP_IMAGE) && !photoFailed;

  return (
    <div className="g-backdrop" aria-hidden="true">
      <div className="g-backdrop-mesh" />
      {showPhoto && (
        <img
          className="g-backdrop-photo"
          src={BACKDROP_IMAGE}
          alt=""
          onError={() => setPhotoFailed(true)}
        />
      )}
      <div className="g-backdrop-scrim" />
      <div className="g-backdrop-grain" />
    </div>
  );
}
