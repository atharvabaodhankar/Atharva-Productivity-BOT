#!/usr/bin/env python3
"""
Manual Git Commit Date Rewriter
Most reliable method - creates new commits with new dates
"""

import subprocess
import random
import sys
import os
from datetime import datetime

# Specific dates from Feb 16th 2026 onwards
DATES = [
    "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
    "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
    "2026-02-24"
]

def run_command(cmd):
    """Run command and return output"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', errors='ignore')
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def main():
    print("=== Manual Git Date Rewriter ===\n")
    
    # Verify git repo
    _, _, code = run_command("git rev-parse --git-dir")
    if code != 0:
        print("Error: Not a git repository")
        sys.exit(1)
    
    # Get info
    current_branch, _, _ = run_command("git rev-parse --abbrev-ref HEAD")
    commit_count_str, _, _ = run_command("git rev-list --count HEAD")
    commit_count = int(commit_count_str)
    
    print(f"Branch: {current_branch}")
    print(f"Commits: {commit_count}\n")
    
    # Create backup
    backup = f"backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    print(f"Creating backup: {backup}")
    run_command(f"git branch {backup}")
    print("✓ Backup created\n")
    
    # Distribution: 2 on 16th, 3 on 17th, 2 on 18th... (total 22)
    # 2, 3, 2, 3, 2, 3, 2, 3, 2 = 22
    distribution = [2, 3, 2, 3, 2, 3, 2, 3, 2]
    
    # If commit count is different from 22, adjust or show warning
    if sum(distribution) != commit_count:
        print(f"Warning: distribution sums to {sum(distribution)} but found {commit_count} commits. Adjusting...")
        # Fallback to random distribution if count is different
        distribution = [1] * len(DATES)
        for _ in range(commit_count - len(DATES)):
            distribution[random.randint(0, len(DATES) - 1)] += 1
    
    print("Distribution:")
    for date, count in zip(DATES, distribution):
        print(f"  {date}: {count} commits")
    print()
    
    # Generate date-times IN SEQUENTIAL ORDER
    commit_dates = []
    for date, count in zip(DATES, distribution):
        for _ in range(count):
            h, m, s = random.randint(9, 18), random.randint(0, 59), random.randint(0, 59)
            commit_dates.append(f"{date} {h:02d}:{m:02d}:{s:02d}")
    
    # Get all commits (newest to oldest)
    commits_raw, _, _ = run_command('git log --format="%H|||%an|||%ae|||%s"')
    
    if not commits_raw:
        print("Error: Could not read commits")
        sys.exit(1)
    
    commits = []
    for line in commits_raw.split('\n'):
        if '|||' in line:
            parts = line.split('|||')
            if len(parts) >= 4:
                commits.append({
                    'hash': parts[0],
                    'author': parts[1],
                    'email': parts[2],
                    'message': '|||'.join(parts[3:])
                })
    
    commits.reverse() # Oldest first
    
    print(f"Found {len(commits)} commits")
    
    # Create orphan branch to rebuild history
    temp_branch = f"temp-rewrite-{datetime.now().strftime('%H%M%S')}"
    run_command(f"git checkout --orphan {temp_branch}")
    
    # Process each commit
    for i, commit_info in enumerate(commits):
        new_date = commit_dates[i] if i < len(commit_dates) else commit_dates[-1]
        
        print(f"[{i+1}/{len(commits)}] {commit_info['hash'][:8]} -> {new_date}")
        
        run_command(f"git checkout {commit_info['hash']} -- .")
        run_command("git add -A")
        
        env = os.environ.copy()
        env['GIT_AUTHOR_NAME'] = commit_info['author']
        env['GIT_AUTHOR_EMAIL'] = commit_info['email']
        env['GIT_AUTHOR_DATE'] = new_date
        env['GIT_COMMITTER_NAME'] = commit_info['author']
        env['GIT_COMMITTER_EMAIL'] = commit_info['email']
        env['GIT_COMMITTER_DATE'] = new_date
        
        message = commit_info['message'].replace('"', '\\"')
        commit_cmd = f'git commit -m "{message}"'
        
        subprocess.run(commit_cmd, shell=True, env=env, capture_output=True)
    
    print("\n✓ Rewrite complete!\n")
    
    run_command(f"git branch -f {current_branch} {temp_branch}")
    run_command(f"git checkout {current_branch}")
    run_command(f"git branch -D {temp_branch}")
    
    print("\nNew commit dates (last 15):")
    output, _, _ = run_command('git log --pretty=format:"%h %ad" --date=short -15')
    print(output)
    
    print("\n\n=== Success! ===")
    print(f"Backup: {backup}")
    print(f"\nTo push: git push --force origin {current_branch}")
    print(f"To restore: git reset --hard {backup}\n")

if __name__ == "__main__":
    main()
