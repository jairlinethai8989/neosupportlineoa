const fs = require('fs');
const path = 'src/app/(dashboard)/inbox/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// Use a more global regex to fix all SVG custom select indicators in this file
const svgPattern = /backgroundImage:\s*'url\("data:image\/svg\+xml;charset=UTF-8,%3csvg xmlns=\\'http:\/\/www\.w3\.org\/2000\/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'3\\' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c\/polyline%3e%3c\/svg%3e"\)',/g;
const validReplacement = "backgroundImage: `url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")`,";

c = c.replace(svgPattern, validReplacement);

fs.writeFileSync(path, c, 'utf8');
console.log('✅ ALL INBOX SVG STYLES FIXED: Global sanitization complete');
