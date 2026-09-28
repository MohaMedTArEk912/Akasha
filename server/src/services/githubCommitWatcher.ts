/**
 * GitHub Commit Watcher & Auto-Task Completion Tracker
 * 
 * Inspects recent commits from a linked GitHub repository and compares them
 * against open team tasks. If a commit addresses an issue (by task ID, title keywords,
 * or touched affected files), automatically marks the task as DONE and records the
 * commit SHA, message, and URL.
 */

import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

interface CommitItem {
    sha: string;
    html_url: string;
    commit: {
        message: string;
        author: {
            name: string;
            date: string;
        };
    };
    files?: Array<{
        filename: string;
        status: string;
    }>;
}

/**
 * Fetch GitHub API helper
 */
async function githubFetch(url: string, token?: string): Promise<any> {
    const fullUrl = url.startsWith('http') ? url : `https://api.github.com${url}`;
    const headers: Record<string, string> = {
        'User-Agent': 'Akasha-Platform-CommitWatcher',
        'Accept': 'application/vnd.github.v3+json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(fullUrl, { headers });
    if (!res.ok) {
        let errMsg = `GitHub API error ${res.status}: ${res.statusText}`;
        try {
            const errData = await res.json();
            if (errData.message) errMsg = errData.message;
        } catch {}
        throw new Error(errMsg);
    }
    return res.json();
}

/**
 * Extract meaningful keywords from a task title (ignoring generic stop words)
 */
function extractTitleKeywords(title: string): string[] {
    const stopWords = new Set([
        'the', 'and', 'for', 'with', 'from', 'this', 'that', 'into', 'onto', 
        'add', 'fix', 'implement', 'update', 'create', 'make', 'resolve'
    ]);
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.has(w));
}

export async function syncGitHubTasksForProject(projectId: string, token?: string, branch?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const settings = safeJsonParse<any>(project.settings, {});
    const repoRef = settings.github_repo;
    if (!repoRef || !repoRef.owner || !repoRef.name) {
        return {
            success: false,
            message: 'Project is not linked to any GitHub repository',
            newlyCompletedCount: 0,
            tasks: settings.teamTasks || []
        };
    }

    const tasks: any[] = Array.isArray(settings.teamTasks) ? settings.teamTasks : [];
    if (tasks.length === 0) {
        return {
            success: true,
            message: 'No tasks found in project to synchronize',
            newlyCompletedCount: 0,
            tasks: []
        };
    }

    const owner = repoRef.owner;
    const repo = repoRef.name;
    const targetBranch = branch || repoRef.default_branch || 'main';

    console.log(`[CommitWatcher] Syncing commits for ${owner}/${repo} against project ${projectId}...`);

    // Fetch recent commits (up to 30)
    let commits: CommitItem[] = [];
    try {
        commits = await githubFetch(
            `/repos/${owner}/${repo}/commits?per_page=30&sha=${encodeURIComponent(targetBranch)}`,
            token
        );
    } catch (err: any) {
        console.warn(`[CommitWatcher] Failed to fetch commits for ${owner}/${repo}:`, err.message);
        throw err;
    }

    if (!Array.isArray(commits) || commits.length === 0) {
        return {
            success: true,
            message: 'No commits found in target branch',
            newlyCompletedCount: 0,
            tasks
        };
    }

    let newlyCompletedCount = 0;
    const newlyCompletedTasks: any[] = [];

    const updatedTasks = tasks.map(task => {
        // Only evaluate non-done tasks
        if (task.status === 'done') return task;

        const taskId = task.id.toLowerCase();
        const titleKeywords = extractTitleKeywords(task.title);
        const affectedFiles = Array.isArray(task.affectedFiles) ? task.affectedFiles : [];

        // Check if any recent commit resolves this task
        for (const c of commits) {
            const msg = (c.commit?.message || '').toLowerCase();
            const shortSha = c.sha.slice(0, 7);

            let matched = false;

            // 1. Explicit Task ID match (e.g. "#task-fix-1", "task-fix-1", etc.)
            if (msg.includes(taskId) || (task.id.length > 8 && msg.includes(task.id.slice(0, 12).toLowerCase()))) {
                matched = true;
            }

            // 2. Keyword overlap match (if at least 2 distinct significant keywords match in commit message)
            if (!matched && titleKeywords.length >= 2) {
                const matchedKeywords = titleKeywords.filter(kw => msg.includes(kw));
                if (matchedKeywords.length >= 2 && (msg.startsWith('fix') || msg.startsWith('feat') || msg.startsWith('refactor') || msg.startsWith('resolve') || msg.includes('done'))) {
                    matched = true;
                }
            }

            // 3. Exact task title match in commit message
            if (!matched && task.title && msg.includes(task.title.toLowerCase().trim())) {
                matched = true;
            }

            // 4. Affected file mention match
            if (!matched && affectedFiles.length > 0) {
                const mentionsFile = affectedFiles.some((f: string) => {
                    const baseName = f.split('/').pop()?.toLowerCase();
                    return baseName && msg.includes(baseName) && (msg.includes('fix') || msg.includes('resolve') || msg.includes('done'));
                });
                if (mentionsFile) {
                    matched = true;
                }
            }

            if (matched) {
                newlyCompletedCount++;
                const completedTask = {
                    ...task,
                    status: 'done' as const,
                    githubCommitSha: shortSha,
                    githubCommitMessage: c.commit.message.split('\n')[0],
                    githubCommitUrl: c.html_url,
                    completedAt: c.commit.author?.date || new Date().toISOString()
                };
                newlyCompletedTasks.push(completedTask);
                console.log(`[CommitWatcher] Task "${task.title}" auto-completed by commit ${shortSha}!`);
                return completedTask;
            }
        }

        return task;
    });

    if (newlyCompletedCount > 0) {
        const updatedSettings = {
            ...settings,
            teamTasks: updatedTasks
        };

        await prisma.project.update({
            where: { id: projectId },
            data: {
                settings: JSON.stringify(updatedSettings)
            }
        });

        console.log(`[CommitWatcher] Successfully updated ${newlyCompletedCount} tasks to DONE in project ${projectId}`);
    }

    return {
        success: true,
        repo: `${owner}/${repo}`,
        branch: targetBranch,
        totalTasks: tasks.length,
        newlyCompletedCount,
        newlyCompletedTasks,
        tasks: updatedTasks
    };
}

/**
 * Check if the linked GitHub repository has new commits.
 * If a new commit SHA is found compared to lastSyncedCommitSha:
 * 1. Resolves matching tasks.
 * 2. Auto-triggers the progressive Agentic Sync Pipeline.
 * 3. Updates lastSyncedCommitSha in project settings.
 */
export async function checkAndAutoSyncProject(projectId: string, token?: string, branch?: string) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const settings = safeJsonParse<any>(project.settings, {});
    const repoRef = settings.github_repo;
    if (!repoRef || !repoRef.owner || !repoRef.name) {
        return { autoSynced: false, reason: 'No GitHub repository connected' };
    }

    const owner = repoRef.owner;
    const repo = repoRef.name;
    const targetBranch = branch || repoRef.default_branch || 'main';

    let commits: CommitItem[] = [];
    try {
        commits = await githubFetch(
            `/repos/${owner}/${repo}/commits?per_page=5&sha=${encodeURIComponent(targetBranch)}`,
            token
        );
    } catch (err: any) {
        console.warn(`[CommitWatcher] Failed to check commits for ${owner}/${repo}:`, err.message);
        return { autoSynced: false, reason: `Failed to fetch commits: ${err.message}` };
    }

    if (!Array.isArray(commits) || commits.length === 0 || !commits[0]) {
        return { autoSynced: false, reason: 'No commits found in branch' };
    }

    const latestCommit = commits[0];
    const latestSha = latestCommit.sha;
    const previousSha = repoRef.lastSyncedCommitSha;

    // Check if this commit is already synced
    if (previousSha && previousSha === latestSha) {
        return {
            autoSynced: false,
            upToDate: true,
            commitSha: latestSha.slice(0, 7),
            commitMessage: latestCommit.commit.message.split('\n')[0]
        };
    }

    console.log(`[CommitWatcher] New commit detected for ${owner}/${repo}: ${latestSha.slice(0, 7)} (was: ${previousSha?.slice(0, 7) || 'none'}). Triggering auto-sync!`);

    // 1. Sync tasks for the project
    let taskSyncResult = { newlyCompletedCount: 0 };
    try {
        taskSyncResult = await syncGitHubTasksForProject(projectId, token, targetBranch);
    } catch (e: any) {
        console.warn('[CommitWatcher] Task auto-resolution error during commit check:', e.message);
    }

    // 2. Update lastSyncedCommitSha in project settings immediately
    const updatedSettings = {
        ...settings,
        github_repo: {
            ...repoRef,
            lastSyncedCommitSha: latestSha,
            lastSyncedCommitMessage: latestCommit.commit.message.split('\n')[0],
            lastSyncedAt: new Date().toISOString()
        }
    };

    await prisma.project.update({
        where: { id: projectId },
        data: { settings: JSON.stringify(updatedSettings) }
    });

    // 3. Trigger progressive Agentic Sync Pipeline in background
    try {
        const { runAutonomousSynthesis } = await import('./agentSynthesizer.js');
        runAutonomousSynthesis(projectId, {
            gitCommitSha: latestSha
        }).catch(err => {
            console.error('[CommitWatcher] Auto-sync pipeline background error:', err);
        });
    } catch (e: any) {
        console.error('[CommitWatcher] Failed to launch agent synthesis pipeline:', e.message);
    }

    return {
        autoSynced: true,
        commitSha: latestSha.slice(0, 7),
        fullSha: latestSha,
        commitMessage: latestCommit.commit.message.split('\n')[0],
        newlyCompletedTasks: taskSyncResult.newlyCompletedCount,
        author: latestCommit.commit.author?.name || 'Developer'
    };
}
