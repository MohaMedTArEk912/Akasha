import { Router } from 'express';
import type { Request, Response } from 'express';
import { handleToolsList, handleToolCall } from '../mcp/akashaMcpServer.js';
import * as path from 'path';

const router = Router();

// GET /api/mcp - Server info & available tools
router.get('/', (_req: Request, res: Response) => {
    res.json({
        name: 'akasha-mcp-server',
        version: '1.0.0',
        protocolVersion: '2024-11-05',
        status: 'READY',
        capabilities: { tools: {} },
        ...handleToolsList()
    });
});

// GET /api/mcp/config - Ready-to-use client configurations
router.get('/config', (req: Request, res: Response) => {
    const rootPath = path.resolve(process.cwd(), '..');
    const serverScript = path.resolve(process.cwd(), 'dist/mcp/akashaMcpServer.js');
    const host = req.get('host') || 'localhost:3001';
    const protocol = req.protocol || 'http';
    const httpEndpoint = `${protocol}://${host}/api/mcp`;

    res.json({
        antigravity: {
            mcpServers: {
                akasha: {
                    command: 'node',
                    args: [serverScript]
                }
            }
        },
        claudeDesktop: {
            mcpServers: {
                akasha: {
                    command: 'node',
                    args: [serverScript]
                }
            }
        },
        httpEndpoint,
        workspaceRoot: rootPath
    });
});

// POST /api/mcp - Standard JSON-RPC 2.0 MCP endpoint (HTTP transport)
router.post('/', async (req: Request, res: Response) => {
    const { jsonrpc = '2.0', id = 1, method, params } = req.body || {};

    if (!method) {
        return res.status(400).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32600, message: 'Invalid Request: method is required' }
        });
    }

    try {
        if (method === 'initialize') {
            return res.json({
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: 'akasha-mcp-server',
                        version: '1.0.0'
                    }
                }
            });
        }

        if (method === 'tools/list') {
            return res.json({
                jsonrpc: '2.0',
                id,
                result: handleToolsList()
            });
        }

        if (method === 'tools/call') {
            const toolName = params?.name;
            const toolArgs = params?.arguments || {};
            const result = await handleToolCall(toolName, toolArgs);

            return res.json({
                jsonrpc: '2.0',
                id,
                result
            });
        }

        return res.status(404).json({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` }
        });
    } catch (err: any) {
        console.error('[HTTP MCP error]:', err);
        return res.status(500).json({
            jsonrpc: '2.0',
            id,
            error: {
                code: -32000,
                message: err.message || 'Internal MCP server error'
            }
        });
    }
});

export default router;
