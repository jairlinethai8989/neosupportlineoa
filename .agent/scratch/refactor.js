const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // hospital_id -> organization_id
  content = content.replace(/hospital_id/g, 'organization_id');
  content = content.replace(/hospitalId/g, 'organizationId');
  
  // hospitals -> organizations
  content = content.replace(/hospitals/g, 'organizations');
  content = content.replace(/Hospitals/g, 'Organizations');
  
  // hospital -> organization (with word boundaries)
  content = content.replace(/\bhospital\b/g, 'organization');
  content = content.replace(/\bHospital\b/g, 'Organization');
  content = content.replace(/\bHOSPITAL\b/g, 'ORGANIZATION');

  // โรงพยาบาล -> องค์กร/บริษัท
  content = content.replace(/โรงพยาบาล/g, 'องค์กร/บริษัท');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      replaceInFile(fullPath);
    }
  }
}

console.log('Starting refactoring...');
walkDir(path.join(__dirname, '../../src'));
console.log('Refactoring complete.');
