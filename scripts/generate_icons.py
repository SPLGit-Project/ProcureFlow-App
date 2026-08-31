import os
from PIL import Image
import numpy as np

# Source image
source_path = r'C:/Users/Aaron.bell/.gemini/antigravity/brain/75af8d70-c8aa-4d59-ae29-47f4d3dc0624/.user_uploaded/media_1788153129930.png'
img = Image.open(source_path).convert('RGBA')
arr = np.array(img, dtype=float)

# Extract foreground color and alpha with sub-pixel antialiasing
fg_r, fg_g, fg_b = 18.0, 165.0, 217.0
alpha = np.clip((255.0 - arr[:, :, 0]) / (255.0 - fg_r) * 255.0, 0, 255)
alpha[alpha < 8] = 0

out_arr = np.zeros_like(arr, dtype=np.uint8)
out_arr[:, :, 0] = int(fg_r)
out_arr[:, :, 1] = int(fg_g)
out_arr[:, :, 2] = int(fg_b)
out_arr[:, :, 3] = alpha.astype(np.uint8)

f_cutout = Image.fromarray(out_arr, 'RGBA')
bbox = f_cutout.getbbox()
f_tight = f_cutout.crop(bbox)
print('Tight F size:', f_tight.size)

MASTER_SIZE = 2048
def render_master(padding_pct=0.12, optical_offset_x_pct=0.03):
    canvas = Image.new('RGBA', (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    target_h = int(MASTER_SIZE * (1.0 - 2 * padding_pct))
    scale = target_h / f_tight.size[1]
    target_w = int(f_tight.size[0] * scale)
    f_resized = f_tight.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    x_pos = int((MASTER_SIZE - target_w) / 2 + optical_offset_x_pct * target_w)
    y_pos = int((MASTER_SIZE - target_h) / 2)
    canvas.paste(f_resized, (x_pos, y_pos), f_resized)
    return canvas

master_transparent = render_master(padding_pct=0.12, optical_offset_x_pct=0.03)

# Save master icon in docs
os.makedirs('docs/Logo Branding/LOGO-NEW', exist_ok=True)
master_transparent.resize((512, 512), Image.Resampling.LANCZOS).save('docs/Logo Branding/LOGO-NEW/Procureflow_Icon.png', 'PNG', optimize=True)

# Generate standard PWA icons
os.makedirs('public/icons', exist_ok=True)
sizes = [16, 24, 32, 48, 64, 72, 96, 128, 144, 152, 180, 192, 384, 512]
for s in sizes:
    resized = master_transparent.resize((s, s), Image.Resampling.LANCZOS)
    resized.save(f'public/icons/icon-{s}x{s}.png', 'PNG', optimize=True)

# Generate multi-layer favicon.ico
ico_layers = [
    master_transparent.resize((16, 16), Image.Resampling.LANCZOS),
    master_transparent.resize((24, 24), Image.Resampling.LANCZOS),
    master_transparent.resize((32, 32), Image.Resampling.LANCZOS),
    master_transparent.resize((48, 48), Image.Resampling.LANCZOS),
    master_transparent.resize((64, 64), Image.Resampling.LANCZOS),
    master_transparent.resize((128, 128), Image.Resampling.LANCZOS),
    master_transparent.resize((256, 256), Image.Resampling.LANCZOS),
]
ico_layers[0].save('public/favicon.ico', format='ICO', sizes=[(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)], append_images=ico_layers[1:])

# Generate Apple Touch Icons (solid dark nocturne background)
def render_apple_touch(size=180):
    canvas = Image.new('RGBA', (size, size), (15, 23, 42, 255))
    target_h = int(size * 0.72)
    scale = target_h / f_tight.size[1]
    target_w = int(f_tight.size[0] * scale)
    f_resized = f_tight.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x_pos = int((size - target_w) / 2 + 0.03 * target_w)
    y_pos = int((size - target_h) / 2)
    canvas.paste(f_resized, (x_pos, y_pos), f_resized)
    return canvas

apple_180 = render_apple_touch(180)
apple_180.save('public/icons/apple-touch-icon.png', 'PNG', optimize=True)
apple_180.save('public/icons/apple-touch-icon-180x180.png', 'PNG', optimize=True)
render_apple_touch(167).save('public/icons/apple-touch-icon-167x167.png', 'PNG', optimize=True)
render_apple_touch(152).save('public/icons/apple-touch-icon-152x152.png', 'PNG', optimize=True)

# Generate Maskable PWA Icons (Android home screen)
def render_maskable(size=512):
    canvas = Image.new('RGBA', (size, size), (15, 23, 42, 255))
    target_h = int(size * 0.60)
    scale = target_h / f_tight.size[1]
    target_w = int(f_tight.size[0] * scale)
    f_resized = f_tight.resize((target_w, target_h), Image.Resampling.LANCZOS)
    x_pos = int((size - target_w) / 2 + 0.03 * target_w)
    y_pos = int((size - target_h) / 2)
    canvas.paste(f_resized, (x_pos, y_pos), f_resized)
    return canvas

render_maskable(512).save('public/icons/icon-maskable-512x512.png', 'PNG', optimize=True)
render_maskable(192).save('public/icons/icon-maskable-192x192.png', 'PNG', optimize=True)

# Update legacy fallback
master_transparent.resize((512, 512), Image.Resampling.LANCZOS).save('public/mercer-m-logo.png', 'PNG', optimize=True)

# Write SVG favicon
svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <path fill="#12a4d9" fill-rule="evenodd" d="M 143.5 66 L 388.5 66 L 388.5 106 L 182.5 106 L 182.5 234 L 353.5 234 L 353.5 272 L 182.5 272 L 182.5 446 L 143.5 446 Z" />
</svg>"""

with open('public/favicon.svg', 'w') as f:
    f.write(svg_content)

with open('public/icons/icon.svg', 'w') as f:
    f.write(svg_content)

print("Icon suite generated successfully!")
