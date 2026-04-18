const fs = require('fs');
const path = 'src/app/(dashboard)/tickets/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// The block that needs fixing:
/*
             </div>
          </div>
        
       <style dangerouslySetInnerHTML={{ __html: `
*/

const target = '            </div>\n         </div>\n         \n        <style';
const replacement = '            </div>\n         </div>\n       )}\n        <style';

if (c.includes(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ Closure fixed');
} else {
    // Try more flexible match
    c = c.replace(/<\/div>\s+<\/div>\s+<style/, '</div>\n         </div>\n       )}\n        <style');
    fs.writeFileSync(path, c, 'utf8');
    console.log('✅ Closure fixed via regex');
}
