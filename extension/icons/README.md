# Extension Icons

Place the following icon files in this directory:

- icon16.png (16x16)
- icon48.png (48x48)
- icon128.png (128x128)

You can generate these from the included icon.svg file using any SVG to PNG converter.

## Quick generation using ImageMagick:

```bash
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

## Using online tools:

- https://cloudconvert.com/svg-to-png
- https://svgtopng.com/

## Placeholder icons

Until you generate proper icons, you can use any 16x16, 48x48, and 128x128 PNG images.
