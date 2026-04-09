
import sys
import os

# Set output to utf-8
sys.stdout.reconfigure(encoding='utf-8')

path = r"d:\Project APP\AntiGravity\neo_line_oa\src\app\(dashboard)\inbox\page.tsx"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(535, 565):
    if i < len(lines):
        line = lines[i]
        print(f"{i+1}: {repr(line)}")
