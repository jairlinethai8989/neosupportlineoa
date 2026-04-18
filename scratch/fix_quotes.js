const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const target = "backgroundImage: 'url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")'";
const replacement = "backgroundImage: `url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e\")`";

if (c.includes(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ Quote fix applied successfully');
} else {
    // Try a more flexible match if string literal doesn't work
    const part = "backgroundImage: 'url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg'";
    if (c.includes(part)) {
        c = c.replace(part, "backgroundImage: `url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg'");
        // Also need to find the ending single quote and replace with backtick
        // This is simplified but should work for this specific file
        c = c.replace('stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e\")\'', 'stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e\")`');
        fs.writeFileSync(path, c, 'utf8');
        console.log('✅ Quote fix applied via partial match');
    } else {
        console.log('❌ CSS target not found');
    }
}
