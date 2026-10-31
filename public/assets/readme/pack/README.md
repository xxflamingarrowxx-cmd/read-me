# Read-Me art pack

Pixel-art assets for the Read-Me app, all drawn in the same chunky 16-bit pixel size, thick dark outline and warm palette. Load these as image files; do not redraw them in code.

## Files
- avatars/avatar-male.jpg, avatars/avatar-female.jpg: the two reader avatars (solid green background to remove).
- room/wall.jpg: wallpaper with crown molding, wainscot and baseboard. Fills the whole back wall.
- room/floor.jpg: wooden plank floor. Fills the floor area.
- room/bookshelf.jpg: empty bookshelf (solid green background to remove). The shelf slot.
- room/window.jpg: window with curtains (solid green background to remove). The glass is plain gray-blue on purpose: show the live weather and day/night scene behind or inside it.
- room/reference-full-room.jpg: reference only, showing how the pieces should look together.
- logo/readme-logo.jpg: Read-Me logo (solid green background to remove).

## Rules
1. Use these images as the room art. Render them with crisp nearest-neighbor scaling (image-rendering: pixelated), no smoothing.
2. Remove the flat green background from the avatars, bookshelf, window and logo so they sit on top of the wall and floor with transparency. Save the cleaned versions as PNG.
3. Keep the layer order, back to front: wall, window, floor, rug, bookshelf, chair, wall decor, souvenirs, avatar, light and shadow overlay.
4. Keep the bookshelf a protected zone: nothing draws over it. Show book cover art inside it, scaled to fit.
5. Keep the live clock, live weather window, day/night cycle, and empty-slot hints.
6. Keep every item in the same pixel scale as these assets, so no object looks sharper or blurrier than the others.
