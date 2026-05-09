import sharp from 'sharp';

const SIZES = [180, 192, 512];

// SVG icon: green rounded background + white "P" wordmark
const makeSvg = (size: number) => {
  const radius = size * 0.2;
  const fontSize = size * 0.52;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#1A6B3C"/>
  <text
    x="${size / 2}"
    y="${size * 0.72}"
    font-family="Georgia, 'Times New Roman', serif"
    font-weight="bold"
    font-size="${fontSize}"
    text-anchor="middle"
    fill="white"
  >P</text>
</svg>`;
};

for (const size of SIZES) {
  const filename =
    size === 180
      ? 'public/apple-touch-icon.png'
      : `public/icon-${size}x${size}.png`;

  await sharp(Buffer.from(makeSvg(size))).png().toFile(filename);
  console.log(`✓ ${filename}`);
}
