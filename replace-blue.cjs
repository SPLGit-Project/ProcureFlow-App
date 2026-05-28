const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'components');

function replaceBlueClass(match, prefix, scale, opacity) {
    let finalOpacity = opacity ? `/${opacity}` : '';

    // Handle light backgrounds/borders (50, 100)
    if (scale === '50') finalOpacity = '/10';
    if (scale === '100') finalOpacity = '/20';
    
    // Handle specific cases like bg-blue-50/30
    if ((scale === '50' || scale === '100') && opacity) {
        finalOpacity = '/10';
    }

    // Handle dark mode washes (800, 900)
    if ((scale === '800' || scale === '900') && !opacity) {
        // Solid dark blue -> somewhat opaque tranquil
        finalOpacity = '/40';
    }

    return `${prefix}-tranquil${finalOpacity}`;
}

function processFile(filePath) {
    const ext = path.extname(filePath);
    if (ext !== '.tsx' && ext !== '.ts') return;

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Regex to match Tailwind utility classes for blue: e.g. bg-blue-500, text-blue-900/20, border-blue-50
    // Captures: 1=prefix (bg|text|border|ring|shadow), 2=scale (50|100...900), 3=opacity (10|20...100)
    const regex = /(bg|text|border|ring|shadow)-blue-([0-9]{2,3})(?:\/([0-9]{1,3}))?/g;

    content = content.replace(regex, replaceBlueClass);

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated: ${path.relative(__dirname, filePath)}`);
    }
}

function walkDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDirectory(fullPath);
        } else {
            processFile(fullPath);
        }
    }
}

console.log('Starting global CSS audit replacements...');
walkDirectory(directoryPath);
console.log('Done.');
