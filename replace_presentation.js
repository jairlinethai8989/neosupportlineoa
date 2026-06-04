const fs = require('fs');
const path = require('path');

const pagePath = path.resolve('src/app/(dashboard)/reports/presentation/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// 1. Add dynamic import at the top
content = content.replace(
  /import \{ supabase \} from '@\/lib\/supabase';/,
  "import { supabase } from '@/lib/supabase';\nimport dynamic from 'next/dynamic';\nimport { Loader2 } from 'lucide-react';\n\nconst PresentationViewer = dynamic(() => import('@/components/reports/PresentationViewer'), { \n  ssr: false, \n  loading: () => <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 className=\"animate-spin text-emerald-500\" /></div> \n});"
);

// 2. Replace the slide block with <PresentationViewer ... />
const startMarker = "{/* Arrow Navigation Overlays */}";
const endMarker = "{/* Right sliding Drawer Background Overlay */}";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  // Find the exact enclosing div to replace. 
  // We can just replace everything from startMarker up to just before endMarker
  // Wait, startMarker is inside the wrapper <div style={{ flex: isPreviewVisible ? 1 : '0 0 auto', ... }}>
  // Let's replace from startMarker to the end of that block.
  
  const replacement = `            <PresentationViewer 
              data={data}
              aiInsights={aiInsights}
              currentSlideIndex={currentSlideIndex}
              setCurrentSlideIndex={setCurrentSlideIndex}
              activeTheme={activeTheme}
              presentationRef={presentationRef}
            />
        `;

  // find the preceding {/* Arrow Navigation Overlays */} line and replace until the end of the div
  // Actually, there are some closing tags before {/* Right sliding Drawer ... */}
  // The structure is:
  //         {data && !loading && (
  //           <>
  //             {/* Arrow Navigation Overlays */}
  //             ...
  //           </>
  //         )}
  //       </div>
  // 
  //       {/* Right sliding Drawer Background Overlay */}

  const exactStart = content.lastIndexOf('{/* Arrow Navigation Overlays */}');
  
  // Find the end of the <></> block wrapping it
  const closingFragment = "          </>\n        )}";
  const exactEnd = content.indexOf(closingFragment, exactStart);

  if (exactStart !== -1 && exactEnd !== -1) {
    content = content.substring(0, exactStart) + replacement + content.substring(exactEnd);
    fs.writeFileSync(pagePath, content);
    console.log("Successfully replaced presentation code!");
  } else {
    console.error("Could not find start/end markers accurately.");
  }
} else {
  console.error("Markers not found.");
}
