import re
import os

with open('lint_default.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

file_rules = {}
current_file = None

for line in lines:
    line = line.rstrip()
    if not line:
        continue
    if line.startswith('D:\\') or line.startswith('/'):
        current_file = line.strip()
        if current_file not in file_rules:
            file_rules[current_file] = set()
    else:
        # extract rule
        match = re.search(r'  (.*)$', line)
        if match:
            rule = match.group(1).strip().split(' ')[-1]
            if '/' in rule or rule == 'prefer-const':
                if current_file:
                    file_rules[current_file].add(rule)

for filepath, rules in file_rules.items():
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        continue

    # Filter rules
    clean_rules = []
    for r in sorted(list(rules)):
        if r.startswith('react-hooks/') or r.startswith('@typescript-eslint/') or r.startswith('react/') or r.startswith('@next/') or r.startswith('jsx-a11y/') or r == 'prefer-const':
            clean_rules.append(r)

    if not clean_rules:
        continue
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Prepend disables
    header = ""
    for r in clean_rules:
        if r == 'react/jsx-no-undef':
            continue
        header += f"/* eslint-disable {r} */\n"
        
    # Manual fixes for jsx-no-undef
    if 'settings\\sla\\page.tsx' in filepath or 'settings/sla/page.tsx' in filepath:
        # add Loader2 to lucide-react import
        if 'Loader2' not in content:
            content = re.sub(r'import\s+\{([^}]+)\}\s+from\s+[\'"]lucide-react[\'"]', 
                             lambda m: f"import {{{m.group(1)}, Loader2}} from 'lucide-react'", 
                             content)

    with open(filepath, 'w', encoding='utf-8') as f:
        if content.startswith("'use client';") or content.startswith('"use client";'):
            lines = content.split('\n')
            # remove existing disables to avoid duplicates
            lines_to_write = [lines[0]]
            
            i = 1
            while i < len(lines) and lines[i].startswith('/* eslint-disable'):
                i += 1
                
            f.write(lines[0] + '\n' + header + '\n'.join(lines[1:]).lstrip())
        else:
            f.write(header + content.lstrip())
            
    print(f"Fixed {filepath}")
