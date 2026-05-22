const fs = require('fs');
const path = require('path');
const readline = require('readline');

const brainDir = 'C:\\Users\\PC\\.gemini\\antigravity\\brain';
const outputFilePath = path.join(__dirname, 'search_results.txt');

// Initialize / clear the output file
fs.writeFileSync(outputFilePath, '=== REHEARSAL DIALOGUE SEARCH RESULTS ===\n\n');

function logToFile(text) {
  fs.appendFileSync(outputFilePath, text + '\n');
}

async function searchFile(filePath, convId) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    try {
      const log = JSON.parse(line);
      const isUser = log.source === 'USER_EXPLICIT';
      const isModel = log.source === 'MODEL';
      
      if ((isUser || isModel) && log.content) {
        const contentStr = log.content;
        
        // Skip file view logs or automated tool reports
        if (contentStr.includes('Showing lines') || 
            contentStr.includes('File Path:') || 
            contentStr.includes('Total Lines:') || 
            contentStr.includes('Total Bytes:') ||
            contentStr.includes('The following code has been modified') ||
            contentStr.includes('Created At:') && contentStr.includes('Completed At:') ||
            contentStr.includes('Completed At:') && contentStr.includes('Output:')
        ) {
          continue;
        }

        const text = contentStr.toLowerCase();
        
        // Look for targeted discussion terms
        const hasKeyword = text.includes('supabase') || 
                            text.includes('navicat') || 
                            text.includes('ซ้อม') || 
                            text.includes('ย้าย') || 
                            text.includes('migration') ||
                            text.includes('ฐานข้อมูล') ||
                            text.includes('server') ||
                            text.includes('db') ||
                            text.includes('docker');

        if (hasKeyword) {
          logToFile(`\n========================================`);
          logToFile(`[Conversation ID: ${convId}] Step ${log.step_index} (${log.source}) at ${log.created_at || 'unknown'}`);
          logToFile(`========================================`);
          logToFile(`${log.source}: ${contentStr}`);
        }
      }
    } catch (e) {
      // Ignore parse errors
    }
  }
}

async function searchAll() {
  if (!fs.existsSync(brainDir)) {
    console.error('Brain directory not found:', brainDir);
    return;
  }

  const items = fs.readdirSync(brainDir);
  logToFile(`Found ${items.length} folders in brain directory. Scanning for transcripts...`);

  for (const item of items) {
    const itemPath = path.join(brainDir, item);
    if (fs.statSync(itemPath).isDirectory()) {
      const transcriptPath = path.join(itemPath, '.system_generated', 'logs', 'transcript.jsonl');
      if (fs.existsSync(transcriptPath)) {
        await searchFile(transcriptPath, item);
      }
    }
  }
  logToFile('\nSearch completed.');
  console.log('Done searching, results in scratch/search_results.txt');
}

searchAll();
