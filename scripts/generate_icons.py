from PIL import Image
import os

# Source icon
source = "public/icons/icon-512x512.png"

# Required sizes for PWA
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

# Maskable sizes (with safe zone padding)
maskable_sizes = [192, 512]

def create_icon(source_path, output_path, size):
    """Resize icon to specified size"""
    img = Image.open(source_path)
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(output_path, 'PNG', optimize=True)
    print(f"Created: {output_path}")

def create_maskable_icon(source_path, output_path, size):
    """Create maskable icon with 20% safe zone padding"""
    # Maskable icons need 20% padding (safe zone)
    padding = int(size * 0.2)
    inner_size = size - (2 * padding)
    
    # Create new image with background
    maskable = Image.new('RGBA', (size, size), (37, 99, 235, 255))  # Blue background
    
    # Resize source to fit in safe zone
    img = Image.open(source_path)
    img = img.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
    
    # Paste centered
    maskable.paste(img, (padding, padding), img if img.mode == 'RGBA' else None)
    maskable.save(output_path, 'PNG', optimize=True)
    print(f"Created maskable: {output_path}")

def create_favicon(source_path, output_path, size):
    """Create favicon"""
    img = Image.open(source_path)
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    img.save(output_path, 'ICO')
    print(f"Created favicon: {output_path}")

# Create all standard icons
for size in sizes:
    if size != 512:  # 512 already exists
        output = f"public/icons/icon-{size}x{size}.png"
        create_icon(source, output, size)

# Create maskable icons
for size in maskable_sizes:
    output = f"public/icons/icon-maskable-{size}x{size}.png"
    create_maskable_icon(source, output, size)

# Create apple-touch-icons
apple_sizes = [152, 167, 180]
for size in apple_sizes:
    output = f"public/icons/apple-touch-icon-{size}x{size}.png"
    create_icon(source, output, size)

# Create standard apple-touch-icon (180x180)
create_icon(source, "public/icons/apple-touch-icon.png", 180)

# Create favicons
create_favicon(source, "public/favicon.ico", 32)

print("\n✅ All icons generated successfully!")
print(f"Total icons created: {len(sizes) - 1 + len(maskable_sizes) + len(apple_sizes) + 2}")
