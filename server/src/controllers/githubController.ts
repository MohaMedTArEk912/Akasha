/**
 * GitHub Controller — OAuth + GitHub API Proxy
 *
 * Handles:
 * - OAuth login redirect & callback (token exchange)
 * - GitHub API proxy calls: user, repos, contents, commits, branches
 * - File-backed token store keyed by session cookie (persists across restarts)
 */

import type { Request, Response } from 'express';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'akasha-standalone-jwt-secret';
let UserModel: any = null;
async function getUserModel() {
    if (UserModel !== null) return UserModel;
    try {
        const userMod = '../../models/User.js'; const mod = await import(userMod);
        UserModel = mod.default;
    } catch {
        UserModel = false;
    }
    return UserModel;
}

// ── Persistent token store (session-id → github access token) ──
const SESSION_FILE = join(process.cwd(), '.akasha', 'github-sessions.json');

function loadTokenStore(): Map<string, string> {
    try {
        if (existsSync(SESSION_FILE)) {
            const raw = readFileSync(SESSION_FILE, 'utf-8');
            const entries: [string, string][] = JSON.parse(raw);
            return new Map(entries);
        }
    } catch {
        // Corrupted file — start fresh
    }
    return new Map();
}

function saveTokenStore(): void {
    try {
        const dir = dirname(SESSION_FILE);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const entries = Array.from(tokenStore.entries());
        writeFileSync(SESSION_FILE, JSON.stringify(entries), 'utf-8');
    } catch (err) {
        console.error('[GitHub] Failed to persist session store:', err);
    }
}

const tokenStore = loadTokenStore();

// ── Helpers ──────────────────────────────────────────────────────

function getClientId(): string {
    return process.env.GITHUB_CLIENT_ID || '';
}

function getClientSecret(): string {
    return process.env.GITHUB_CLIENT_SECRET || '';
}

function generateSessionId(): string {
    return crypto.randomUUID();
}

function getSessionId(req: Request): string | null {
    // 1. Check x-gh-session header (localStorage-based, most reliable)
    const headerSession = req.headers['x-gh-session'] as string | undefined;
    if (headerSession) return headerSession;

    // 2. Fallback to cookie header (legacy)
    const cookies = req.headers.cookie || '';
    const match = cookies.match(/gh_session=([^;]+)/);
    return match?.[1] ?? null;
}

function setSessionCookie(res: Response, sessionId: string): void {
    res.setHeader('Set-Cookie', `gh_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
}

async function getToken(req: Request): Promise<string | null> {
    // 1. Try to get token from authenticated user from DB
    if ((req as any).user?.id) {
        try {
            const user = (await getUserModel()) && await (await getUserModel()).findById((req as any).user.id);
            if (user && user.githubAccessToken) {
                return user.githubAccessToken;
            }
        } catch (err) {
            console.error('[GitHub] Error fetching user github token from DB:', err);
        }
    }
    // 2. Fallback to session cookie
    const sid = getSessionId(req);
    if (!sid) return null;
    const sessionToken = tokenStore.get(sid) || null;

    // 3. Auto-save session token to user DB if logged in
    if (sessionToken && (req as any).user?.id) {
        try {
            (await getUserModel()) && await (await getUserModel()).findByIdAndUpdate((req as any).user.id, { githubAccessToken: sessionToken });
            console.log(`[GitHub] Auto-saved session token to database for user ${(req as any).user.id}`);
        } catch (dbErr) {
            console.error('[GitHub] Failed to auto-save session token to DB:', dbErr);
        }
    }

    return sessionToken;
}

async function githubFetch(path: string, token: string, options: RequestInit = {}): Promise<any> {
    const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'Akasha-IDE/1.0',
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`GitHub API ${res.status}: ${body}`);
    }
    return res.json();
}

// ── OAuth Flow ───────────────────────────────────────────────────

/**
 * GET /api/github/login
 * Redirects the browser to GitHub OAuth authorize page.
 */
export function login(req: Request, res: Response): void {
    const clientId = getClientId();
    if (!clientId) {
        res.status(500).json({ error: 'GITHUB_CLIENT_ID not configured' });
        return;
    }

    const redirectUri = process.env.GITHUB_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/akasha/github/callback`;
    const scope = 'repo user';
    const state = generateSessionId(); // CSRF protection nonce

    // Try to get userId from (req as any).user (populated by authenticate middleware)
    let userId = (req as any).user?.id || '';

    // Extract user token from query params if (req as any).user is not set (from the popup window fallback)
    if (!userId) {
        const token = req.query.token as string;
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
                userId = decoded.id || '';
            } catch (err) {
                console.error('[GitHub OAuth] JWT verification failed in login:', err);
            }
        }
    }

    // Store the state temporarily so we can verify it in callback
    tokenStore.set(`state:${state}`, userId || 'pending');
    saveTokenStore();

    const url = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

    res.redirect(url);
}

/**
 * GET /api/github/callback?code=xxx&state=yyy
 * Exchanges the code for an access token, stores it, and redirects to frontend.
 */
export async function callback(req: Request, res: Response): Promise<void> {
    try {
        const { code, state } = req.query as { code?: string; state?: string };

        if (!code) {
            res.status(400).send('Missing code parameter');
            return;
        }

        let userId = '';
        // Verify state
        if (state) {
            if (!tokenStore.has(`state:${state}`)) {
                res.status(403).send('Invalid state parameter');
                return;
            }
            const stateVal = tokenStore.get(`state:${state}`);
            if (stateVal && stateVal !== 'pending') {
                userId = stateVal;
            }
            tokenStore.delete(`state:${state}`);
            saveTokenStore();
        }

        const clientId = getClientId();
        const clientSecret = getClientSecret();

        // Exchange code for token
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
            }),
        });

        const tokenData = await tokenRes.json() as any;

        if (!tokenData.access_token) {
            res.status(400).send(`GitHub OAuth failed: ${tokenData.error_description || tokenData.error || 'Unknown error'}`);
            return;
        }

        // Store the token with a new session ID
        const sessionId = generateSessionId();
        tokenStore.set(sessionId, tokenData.access_token);
        saveTokenStore();
        setSessionCookie(res, sessionId);

        // Save to user DB if we have a verified user ID
        if (userId) {
            try {
                (await getUserModel()) && await (await getUserModel()).findByIdAndUpdate(userId, { githubAccessToken: tokenData.access_token });
                console.log(`[GitHub OAuth] Successfully saved githubAccessToken for user ${userId}`);
            } catch (dbErr) {
                console.error('[GitHub OAuth] Failed to save githubAccessToken to database:', dbErr);
            }
        }

        // Redirect back to the frontend with a success indicator
        // The frontend polls /api/github/status after the popup closes
        // Pass the sessionId via postMessage so the frontend can save it in localStorage
        res.send(`
            <!DOCTYPE html>
            <html><head><title>GitHub Connected</title></head>
            <body style="background:#050508;color:white;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                <div style="text-align:center">
                    <div style="font-size:48px;margin-bottom:16px">✓</div>
                    <h2 style="margin:0 0 8px">Connected to GitHub</h2>
                    <p style="opacity:0.6;font-size:14px">This window will close automatically...</p>
                </div>
                <script>
                    if (window.opener) {
                        window.opener.postMessage({
                            type: 'github-oauth-success',
                            sessionId: '${sessionId}'
                        }, '*');
                    }
                    setTimeout(() => window.close(), 1500);
                </script>
            </body></html>
        `);
    } catch (error: any) {
        console.error('[GitHub] OAuth callback failed:', error);
        res.status(500).send(`OAuth failed: ${error.message}`);
    }
}

// ── API Endpoints ────────────────────────────────────────────────

/**
 * GET /api/github/status
 * Returns connection status + user profile if connected.
 */
export async function getStatus(req: Request, res: Response): Promise<void> {
    try {
        const token = await getToken(req);
        if (!token) {
            res.json({ connected: false, user: null });
            return;
        }

        const user = await githubFetch('/user', token);
        res.json({
            connected: true,
            user: {
                login: user.login,
                name: user.name,
                avatar_url: user.avatar_url,
                bio: user.bio,
                public_repos: user.public_repos,
                html_url: user.html_url,
            },
        });
    } catch (error: any) {
        // Token might be expired/revoked
        const sid = getSessionId(req);
        if (sid) {
            tokenStore.delete(sid);
            saveTokenStore();
        }
        if ((req as any).user?.id) {
            try {
                (await getUserModel()) && await (await getUserModel()).findByIdAndUpdate((req as any).user.id, { githubAccessToken: '' });
            } catch (dbErr) {
                console.error('[GitHub] Failed to clear expired token from DB:', dbErr);
            }
        }
        res.json({ connected: false, user: null });
    }
}

/**
 * GET /api/github/repos?page=1&per_page=30&sort=updated
 * Lists the authenticated user's repos.
 */
export async function listRepos(req: Request, res: Response): Promise<void> {
    try {
        const token = await getToken(req);
        if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

        const page = req.query.page || '1';
        const perPage = req.query.per_page || '30';
        const sort = req.query.sort || 'updated';

        const repos = await githubFetch(`/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&affiliation=owner,collaborator`, token);
        res.json(repos);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * POST /api/github/repos
 * Creates a new repository.
 * Body: { name, description?, private? }
 */
export async function createRepo(req: Request, res: Response): Promise<void> {
    try {
        const token = await getToken(req);
        if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

        const { name, description, private: isPrivate } = req.body;
        if (!name) { res.status(400).json({ error: 'Repository name is required' }); return; }

        const repo = await githubFetch('/user/repos', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                description: description || '',
                private: isPrivate ?? false,
                auto_init: true,
            }),
        });

        res.json(repo);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/github/repos/:owner/:repo/contents?path=&ref=
 * Fetches file/directory contents.
 */
export async function getContents(req: Request, res: Response): Promise<void> {
    try {
        const token = await getToken(req);
        if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

        const { owner, repo } = req.params;
        const dirPath = (req.query.path as string) || '';
        const ref = (req.query.ref as string) || '';

        let url = `/repos/${owner}/${repo}/contents/${dirPath}`;
        if (ref) url += `?ref=${encodeURIComponent(ref)}`;

        const contents = await githubFetch(url, token);
        res.json(contents);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/github/repos/:owner/:repo/commits?per_page=20&sha=
 * Fetches recent commits.
 */
export async function getCommits(req: Request, res: Response): Promise<void> {
    try {
        const token = await getToken(req);
        if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

        const { owner, repo } = req.params;
        const perPage = req.query.per_page || '20';
        const sha = req.query.sha || '';

        let url = `/repos/${owner}/${repo}/commits?per_page=${perPage}`;
        if (sha) url += `&sha=${encodeURIComponent(sha as string)}`;

        const commits = await githubFetch(url, token);
        res.json(commits);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /api/github/repos/:owner/:repo/branches
 * Lists branches.
 */
export async function getBranches(req: Request, res: Response): Promise<void> {
    try {
        const token = await getToken(req);
        if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }

        const { owner, repo } = req.params;
        const branches = await githubFetch(`/repos/${owner}/${repo}/branches`, token);
        res.json(branches);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}

/**
 * POST /api/github/disconnect
 * Clears the stored token.
 */
export async function disconnect(req: Request, res: Response): Promise<void> {
    const sid = getSessionId(req);
    if (sid) {
        tokenStore.delete(sid);
        saveTokenStore();
    }
    if ((req as any).user?.id) {
        try {
            (await getUserModel()) && await (await getUserModel()).findByIdAndUpdate((req as any).user.id, { githubAccessToken: '' });
            console.log(`[GitHub OAuth] Successfully cleared githubAccessToken in DB for user ${(req as any).user.id}`);
        } catch (dbErr) {
            console.error('[GitHub OAuth] Failed to clear githubAccessToken in DB:', dbErr);
        }
    }
    // Clear cookie
    res.setHeader('Set-Cookie', 'gh_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ success: true });
}
