"""Extract supplied artwork without redrawing, moving, or recoloring its parts."""
from collections import Counter
from pathlib import Path
from PIL import Image
import json

folder = Path('public/brand')
mark = Image.open(folder / 'mark-original.png').convert('RGB')
dominant = Counter(rgb for rgb in mark.get_flattened_data() if rgb[2] > 180 and rgb[0] < 60 and rgb[1] < 130).most_common(1)[0][0]
transparent = Image.new('RGBA', mark.size)
pixels = []
for r, g, b in mark.get_flattened_data():
    if b > 140 and b - r > 35 and b - g > 35:
        if r < 32:
            pixels.append((r, g, b, 255))
        else:
            alpha = 255 - r
            pixels.append((0, max(0, min(255, round((g - r) * 255 / alpha))), max(0, min(255, round((b - r) * 255 / alpha))), alpha))
    else:
        pixels.append((0, 0, 0, 0))
transparent.putdata(pixels)
mark_bounds = transparent.getbbox()
transparent = transparent.crop(mark_bounds)
transparent.save(folder / 'mark.png', optimize=True)
transparent.resize((64, 64), Image.Resampling.LANCZOS).save('public/favicon.png')

# The wordmark is separate, so only its text changes color in the dark theme.
logo = Image.open(folder / 'logo-original.png').convert('RGB')
word = Image.new('RGBA', logo.size)
word_pixels = []
for index, (r, g, b) in enumerate(logo.get_flattened_data()):
    x = index % logo.width
    alpha = max(0, min(255, round((250 - min(r, g, b)) * 255 / 225))) if x > logo.width * .28 and max(r, g, b) - min(r, g, b) < 35 else 0
    if alpha < 18:
        alpha = 0
    word_pixels.append((0, 0, 0, alpha))
word.putdata(word_pixels)
word_bounds = word.getchannel('A').point(lambda value: 255 if value > 200 else 0).getbbox()
word = word.crop((word_bounds[0] - 1, word_bounds[1] - 1, word_bounds[2] + 1, word_bounds[3] + 1))
word.save(folder / 'wordmark.png', optimize=True)
metadata = {'source': 'Original images attached in this conversation', 'blue': '#%02X%02X%02X' % dominant, 'mark_bounds': mark_bounds, 'mark_size': transparent.size, 'wordmark_size': word.size}
(folder / 'source.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
print(json.dumps(metadata))
