import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import { useProjectStore } from "../hooks/useProjectStore";
import { useApi } from "../hooks/useApi";
import {
    loadSandbox,
    saveSandbox,
    hasSandboxChanges,
} from "../stores/projectStore";
import type { SandboxData } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import { generateStructuredIdea, setProject } from "../stores/projectStore";

const client = axios.create({
  baseURL: "/api/akasha",
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("akasha_token")?.trim();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  const apiKey = localStorage.getItem("akasha_api_key")?.trim();
  if (apiKey) config.headers["x-ai-api-key"] = apiKey;
  const model = localStorage.getItem("akasha_model")?.trim();
  if (model) config.headers["x-ai-model"] = model;
  const apiBaseUrl = localStorage.getItem("akasha_api_base_url")?.trim();
  if (apiBaseUrl) config.headers["x-ai-api-base-url"] = apiBaseUrl;
  return config;
});

interface PageDefinition {
  name: string;
  path: string;
  type: string;
  description: string;
  _html?: string;
  _accepted?: boolean;
}

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "typing";
  text: string;
  html?: string;
}

function ensureDocumentHead(doc: Document): HTMLHeadElement | null {
  if (doc.head) return doc.head;

  const existingHead = doc.getElementsByTagName("head")[0];
  if (existingHead) return existingHead as HTMLHeadElement;

  const root = doc.documentElement || doc.getElementsByTagName("html")[0];
  if (!root) return null;

  const head = doc.createElement("head");
  if (root.firstChild) {
    root.insertBefore(head, root.firstChild);
  } else {
    root.appendChild(head);
  }

  return head;
}

const PAGE_ICONS: Record<string, string> = {
  dashboard: "ti-layout-dashboard",
  auth: "ti-lock",
  settings: "ti-settings",
  list: "ti-list",
  detail: "ti-file-description",
  landing: "ti-home",
  search: "ti-search",
  profile: "ti-user",
};

const SITEMAP_LANES = [
  { id: "gateways", label: "Gateways", types: ["landing", "auth"], icon: "ti-door-enter" },
  { id: "hubs", label: "Core Hubs", types: ["dashboard", "profile"], icon: "ti-layout-grid" },
  { id: "views", label: "Data Views", types: ["list", "search"], icon: "ti-list-details" },
  { id: "utilities", label: "Utilities", types: ["detail", "settings"], icon: "ti-settings-automation" },
];

// High-quality starter templates
const STARTER_TEMPLATES: Record<string, string> = {
  blank: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Blank Canvas</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f2f4f8; color: #1a1d23; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; }
    .card { background: white; padding: 48px 40px; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); text-align: center; max-width: 480px; border: 1px solid rgba(0,0,0,0.04); animation: fadeIn 0.5s ease; }
    .card-icon { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: white; font-size: 24px; }
    .card h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .card p { font-size: 14px; color: #6b7280; line-height: 1.6; }
    .card-hint { margin-top: 16px; font-size: 12px; color: #9ca3af; display: flex; align-items: center; justify-content: center; gap: 6px; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-icon"><i class="ti ti-wand"></i></div>
    <h2>Blank Canvas</h2>
    <p>This page is ready for the AI agent. Describe what you want to build in the chat panel on the right — components, layouts, forms, or full pages.</p>
    <div class="card-hint"><i class="ti ti-message" style="font-size:12px"></i> Ask the agent to get started</div>
  </div>
</body>
</html>`,
  dashboard: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Overview Dashboard</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; display: flex; height: 100vh; background: #f0f2f5; color: #1e293b; }
    .sidebar { width: 240px; background: #0b1120; color: white; padding: 24px 16px; display: flex; flex-direction: column; gap: 6px; }
    .sidebar-brand { display: flex; align-items: center; gap: 10px; padding: 0 10px 24px; font-size: 16px; font-weight: 800; color: #818cf8; letter-spacing: -0.02em; }
    .sidebar-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 500; color: #94a3b8; transition: all 0.15s; }
    .sidebar-item:hover, .sidebar-item.active { color: white; background: rgba(129,140,248,0.12); }
    .sidebar-item.active { color: #818cf8; }
    .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .header { height: 64px; background: white; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; flex-shrink: 0; }
    .header-left { display: flex; align-items: center; gap: 24px; }
    .header h3 { font-size: 14px; font-weight: 600; color: #374151; }
    .header-right { display: flex; align-items: center; gap: 16px; }
    .search-box { display: flex; align-items: center; gap: 8px; background: #f3f4f6; border-radius: 8px; padding: 7px 12px; font-size: 12px; color: #9ca3af; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; cursor: pointer; }
    .content { padding: 24px 32px; display: flex; flex-direction: column; gap: 24px; overflow-y: auto; flex: 1; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .metric-card { background: white; padding: 20px; border-radius: 14px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: transform 0.15s, box-shadow 0.15s; }
    .metric-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
    .metric-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
    .metric-card .value { font-size: 22px; font-weight: 700; color: #111827; }
    .metric-card .trend { font-size: 11px; margin-top: 4px; display: flex; align-items: center; gap: 3px; }
    .trend.up { color: #10b981; }
    .trend.down { color: #ef4444; }
    .table-card { background: white; border-radius: 14px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.04); overflow: hidden; }
    .table-header { padding: 16px 24px; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th, td { padding: 12px 24px; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
    th { background: #f9fafb; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; font-size: 10.5px; }
    td { color: #374151; }
    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 500; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .pagination { display: flex; align-items: center; justify-content: space-between; padding: 12px 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .pagination-btns { display: flex; gap: 4px; }
    .page-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid #e5e7eb; background: white; cursor: pointer; font-size: 12px; transition: all 0.12s; }
    .page-btn:hover { border-color: #6366f1; color: #6366f1; }
    .page-btn.active { background: #6366f1; color: white; border-color: #6366f1; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .content > * { animation: fadeIn 0.4s ease forwards; }
    .content > *:nth-child(2) { animation-delay: 0.1s; }
    .content > *:nth-child(3) { animation-delay: 0.2s; }
  </style>
</head>
<body>
  <div class="sidebar">
    <div class="sidebar-brand"><i class="ti ti-layout-grid"></i> Console</div>
    <div class="sidebar-item active"><i class="ti ti-dashboard"></i> Overview</div>
    <div class="sidebar-item"><i class="ti ti-chart-bar"></i> Analytics</div>
    <div class="sidebar-item"><i class="ti ti-users"></i> Team</div>
    <div class="sidebar-item"><i class="ti ti-settings"></i> Settings</div>
  </div>
  <div class="main">
    <div class="header">
      <div class="header-left">
        <h3>System Overview</h3>
        <div class="search-box"><i class="ti ti-search"></i><span>Search dashboard...</span></div>
      </div>
      <div class="header-right">
        <i class="ti ti-bell" style="font-size:18px;color:#9ca3af;cursor:pointer"></i>
        <div class="avatar">JD</div>
      </div>
    </div>
    <div class="content">
      <div class="metrics">
        <div class="metric-card">
          <div class="label"><i class="ti ti-coin"></i> Total Revenue</div>
          <div class="value">$48,250</div>
          <div class="trend up"><i class="ti ti-trending-up"></i> +12.5%</div>
        </div>
        <div class="metric-card">
          <div class="label"><i class="ti ti-users"></i> Active Users</div>
          <div class="value">2,847</div>
          <div class="trend up"><i class="ti ti-trending-up"></i> +8.2%</div>
        </div>
        <div class="metric-card">
          <div class="label"><i class="ti ti-shopping-cart"></i> Orders</div>
          <div class="value">1,432</div>
          <div class="trend up"><i class="ti ti-trending-up"></i> +3.7%</div>
        </div>
        <div class="metric-card">
          <div class="label"><i class="ti ti-alert-triangle"></i> Bounce Rate</div>
          <div class="value">24.1%</div>
          <div class="trend down"><i class="ti ti-trending-down"></i> -1.4%</div>
        </div>
      </div>
      <div class="table-card">
        <div class="table-header"><i class="ti ti-file-invoice"></i> Recent Invoices</div>
        <table>
          <thead>
            <tr><th>Invoice</th><th>Client</th><th>Plan</th><th>Amount</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            <tr><td style="font-weight:600">#INV-0248</td><td>Acme Corporation</td><td>Enterprise</td><td>$2,499.00</td><td><span class="badge badge-paid">Paid</span></td><td>Mar 12, 2025</td></tr>
            <tr><td style="font-weight:600">#INV-0247</td><td>Brightside Media</td><td>Pro</td><td>$149.00</td><td><span class="badge badge-pending">Pending</span></td><td>Mar 10, 2025</td></tr>
            <tr><td style="font-weight:600">#INV-0246</td><td>CloudScale Inc</td><td>Enterprise</td><td>$2,499.00</td><td><span class="badge badge-paid">Paid</span></td><td>Mar 8, 2025</td></tr>
            <tr><td style="font-weight:600">#INV-0245</td><td>Design Studio 9</td><td>Starter</td><td>$29.00</td><td><span class="badge badge-cancelled">Cancelled</span></td><td>Mar 5, 2025</td></tr>
            <tr><td style="font-weight:600">#INV-0244</td><td>NexGen Labs</td><td>Pro</td><td>$149.00</td><td><span class="badge badge-paid">Paid</span></td><td>Mar 3, 2025</td></tr>
          </tbody>
        </table>
        <div class="pagination">
          <span>Showing 1-5 of 24 invoices</span>
          <div class="pagination-btns">
            <button class="page-btn active">1</button>
            <button class="page-btn">2</button>
            <button class="page-btn">3</button>
            <button class="page-btn"><i class="ti ti-chevron-right" style="font-size:11px"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`,
  landing: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LaunchPad — Build Faster</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.6; }
    .navbar { position: fixed; top: 0; left: 0; right: 0; height: 72px; display: flex; align-items: center; justify-content: space-between; padding: 0 48px; background: rgba(255,255,255,0.85); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(0,0,0,0.04); z-index: 50; }
    .logo { font-weight: 900; font-size: 22px; background: linear-gradient(135deg, #6366f1, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.02em; display: flex; align-items: center; gap: 8px; }
    .nav-links { display: flex; gap: 32px; list-style: none; }
    .nav-links a { text-decoration: none; color: #475569; font-size: 14px; font-weight: 500; transition: color 0.15s; }
    .nav-links a:hover { color: #6366f1; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; cursor: pointer; border: none; transition: all 0.15s; font-family: inherit; }
    .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; box-shadow: 0 4px 16px rgba(99,102,241,0.35); }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(99,102,241,0.45); }
    .btn-secondary { background: white; color: #0f172a; border: 1px solid #e2e8f0; }
    .btn-secondary:hover { border-color: #6366f1; color: #6366f1; }
    .hero { padding: 160px 48px 100px; text-align: center; position: relative; overflow: hidden; }
    .hero::before { content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at 50% 40%, rgba(99,102,241,0.06) 0%, transparent 50%); pointer-events: none; }
    .hero h1 { font-size: 56px; font-weight: 900; letter-spacing: -0.03em; line-height: 1.1; margin-bottom: 20px; background: linear-gradient(135deg, #0f172a 40%, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 18px; color: #64748b; max-width: 600px; margin: 0 auto 36px; }
    .hero-btns { display: flex; gap: 12px; justify-content: center; }
    .features { padding: 80px 48px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; max-width: 1100px; margin: 0 auto; }
    .feature-card { padding: 28px; background: white; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); transition: transform 0.2s, box-shadow 0.2s; }
    .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
    .feature-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 16px; color: white; }
    .feature-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
    .feature-card p { font-size: 13px; color: #64748b; line-height: 1.7; }
    .footer { text-align: center; padding: 40px; color: #94a3b8; font-size: 13px; border-top: 1px solid #e2e8f0; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    .hero, .features { animation: fadeUp 0.6s ease; }
    .features > *:nth-child(2) { animation-delay: 0.1s; }
    .features > *:nth-child(3) { animation-delay: 0.2s; }
  </style>
</head>
<body>
  <nav class="navbar">
    <div class="logo"><i class="ti ti-sparkles" style="-webkit-text-fill-color:#6366f1;font-size:20px"></i> LaunchPad</div>
    <ul class="nav-links">
      <li><a href="#">Features</a></li>
      <li><a href="#">Pricing</a></li>
      <li><a href="#">Docs</a></li>
      <li><a href="#">Blog</a></li>
    </ul>
    <div><a href="#" class="btn btn-primary"><span>Get Started</span><i class="ti ti-arrow-right" style="font-size:14px"></i></a></div>
  </nav>
  <section class="hero">
    <h1>Build production-ready<br>interfaces with AI</h1>
    <p>Describe what you need and watch as AI generates complete, polished pages with real data, interactive elements, and your design tokens applied.</p>
    <div class="hero-btns">
      <a href="#" class="btn btn-primary"><i class="ti ti-wand"></i> Start Building</a>
      <a href="#" class="btn btn-secondary"><i class="ti ti-brand-github"></i> View on GitHub</a>
    </div>
  </section>
  <section class="features">
    <div class="feature-card">
      <div class="feature-icon" style="background:linear-gradient(135deg,#6366f1,#a78bfa)"><i class="ti ti-message"></i></div>
      <h3>AI-Powered Edits</h3>
      <p>Chat with an AI agent that understands your design system. Make complex layout changes with natural language commands.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon" style="background:linear-gradient(135deg,#f59e0b,#f97316)"><i class="ti ti-palette"></i></div>
      <h3>Design Token Sync</h3>
      <p>Your brand colors, fonts, and spacing are automatically applied to every generated page. Consistent design, zero effort.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon" style="background:linear-gradient(135deg,#10b981,#34d399)"><i class="ti ti-code"></i></div>
      <h3>Clean HTML Output</h3>
      <p>Every page is standalone, semantic HTML with inline CSS and vanilla JS. No framework lock-in, no build step required.</p>
    </div>
  </section>
  <div class="footer">Built with <i class="ti ti-heart-filled" style="color:#ef4444;font-size:12px"></i> for modern teams</div>
</body>
</html>`,
  auth: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In — Console</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #0b1120; display: flex; height: 100vh; align-items: center; justify-content: center; position: relative; overflow: hidden; }
    body::before { content: ''; position: absolute; top: -40%; left: -30%; width: 80%; height: 80%; background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 60%); pointer-events: none; }
    body::after { content: ''; position: absolute; bottom: -30%; right: -20%; width: 60%; height: 60%; background: radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 60%); pointer-events: none; }
    .auth-card { background: #161e2e; width: 400px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.06); padding: 40px; box-shadow: 0 24px 48px rgba(0,0,0,0.4); position: relative; animation: slideUp 0.5s ease; }
    .auth-logo { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg,#6366f1,#8b5cf6); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: white; font-size: 22px; }
    .auth-card h2 { font-size: 22px; font-weight: 700; margin-bottom: 4px; text-align: center; color: white; }
    .auth-card .sub { font-size: 13px; color: #94a3b8; margin-bottom: 28px; text-align: center; }
    .social-btns { display: flex; gap: 10px; margin-bottom: 20px; }
    .social-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.04); color: #cbd5e1; cursor: pointer; font-size: 13px; font-weight: 500; font-family: inherit; transition: all 0.15s; }
    .social-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.12); }
    .divider { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; }
    .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
    .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .form-group label { font-size: 12px; font-weight: 600; color: #94a3b8; }
    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-wrap i { position: absolute; left: 12px; font-size: 16px; color: #475569; pointer-events: none; }
    .form-group input { width: 100%; padding: 11px 12px 11px 38px; background: #0f172a; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; color: white; font-size: 13px; outline: none; font-family: inherit; transition: border-color 0.15s; }
    .form-group input:focus { border-color: #6366f1; }
    .form-group input::placeholder { color: #475569; }
    .auth-btn { width: 100%; padding: 12px; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; font-weight: 600; border: none; border-radius: 10px; cursor: pointer; font-size: 14px; font-family: inherit; transition: all 0.15s; margin-top: 4px; }
    .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(99,102,241,0.35); }
    .auth-footer { text-align: center; margin-top: 20px; font-size: 12px; color: #64748b; }
    .auth-footer a { color: #818cf8; text-decoration: none; font-weight: 500; }
    .auth-footer a:hover { text-decoration: underline; }
    @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  </style>
</head>
<body>
  <div class="auth-card">
    <div class="auth-logo"><i class="ti ti-lock"></i></div>
    <h2>Welcome back</h2>
    <p class="sub">Sign in to your account to continue</p>
    <div class="social-btns">
      <button class="social-btn"><i class="ti ti-brand-google"></i> Google</button>
      <button class="social-btn"><i class="ti ti-brand-github"></i> GitHub</button>
    </div>
    <div class="divider">or continue with email</div>
    <form onsubmit="event.preventDefault();alert('Demo: sign-in successful!')">
      <div class="form-group">
        <label>Email address</label>
        <div class="input-wrap"><i class="ti ti-mail"></i><input type="email" placeholder="you@company.com" required></div>
      </div>
      <div class="form-group">
        <label>Password</label>
        <div class="input-wrap"><i class="ti ti-lock"></i><input type="password" placeholder="········" required></div>
      </div>
      <button type="submit" class="auth-btn">Sign in</button>
    </form>
    <div class="auth-footer">Don't have an account? <a href="#">Create one</a></div>
  </div>
</body>
</html>`,
  settings: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Settings — Console</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f0f2f5; color: #1e293b; }
    .layout { display: flex; min-height: 100vh; }
    .side-menu { width: 240px; background: white; border-right: 1px solid #e5e7eb; padding: 24px 16px; display: flex; flex-direction: column; gap: 4px; }
    .side-menu h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; padding: 0 12px 16px; font-weight: 600; }
    .menu-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 500; color: #64748b; transition: all 0.12s; }
    .menu-item:hover { background: #f1f5f9; color: #1e293b; }
    .menu-item.active { background: #eef2ff; color: #6366f1; font-weight: 600; }
    .main-content { flex: 1; padding: 32px 40px; max-width: 720px; }
    .main-content h2 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    .main-content .desc { font-size: 13px; color: #64748b; margin-bottom: 28px; }
    .card { background: white; border-radius: 16px; border: 1px solid #e5e7eb; padding: 28px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .card-title { font-size: 14px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
    .form-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
    .form-row:last-child { border-bottom: none; }
    .form-row label { font-size: 13px; color: #374151; font-weight: 500; }
    .form-row .hint { font-size: 11px; color: #9ca3af; margin-top: 2px; }
    input[type="text"], select { padding: 8px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; outline: none; font-family: inherit; background: white; min-width: 200px; transition: border-color 0.12s; }
    input[type="text"]:focus, select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
    .toggle { position: relative; width: 40px; height: 22px; cursor: pointer; }
    .toggle input { display: none; }
    .toggle-slider { position: absolute; inset: 0; background: #d1d5db; border-radius: 999px; transition: 0.2s; }
    .toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 2px; left: 2px; transition: 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
    .toggle input:checked + .toggle-slider { background: #6366f1; }
    .toggle input:checked + .toggle-slider::before { transform: translateX(18px); }
    .btn { padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px; cursor: pointer; border: none; font-family: inherit; transition: all 0.12s; }
    .btn-primary { background: #6366f1; color: white; }
    .btn-primary:hover { background: #4f46e5; }
    .btn-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .btn-danger:hover { background: #fee2e2; }
  </style>
</head>
<body>
  <div class="layout">
    <div class="side-menu">
      <h3>Settings</h3>
      <div class="menu-item active"><i class="ti ti-user"></i> Profile</div>
      <div class="menu-item"><i class="ti ti-lock"></i> Security</div>
      <div class="menu-item"><i class="ti ti-bell"></i> Notifications</div>
      <div class="menu-item"><i class="ti ti-credit-card"></i> Billing</div>
      <div class="menu-item" style="margin-top:auto;color:#ef4444"><i class="ti ti-logout"></i> Sign out</div>
    </div>
    <div class="main-content">
      <h2>Profile Settings</h2>
      <p class="desc">Manage your account details and preferences</p>
      <div class="card">
        <div class="card-title"><i class="ti ti-user-circle" style="color:#6366f1"></i> Personal Information</div>
        <div class="form-row">
          <div><label>Full name</label><div class="hint">Your display name on the platform</div></div>
          <input type="text" value="Jane Doe">
        </div>
        <div class="form-row">
          <div><label>Email address</label><div class="hint">Used for notifications and sign-in</div></div>
          <input type="text" value="jane@company.com">
        </div>
        <div class="form-row">
          <div><label>Timezone</label><div class="hint">Affects all date/time displays</div></div>
          <select><option>UTC (Coordinated Universal Time)</option><option>America/New York (EST)</option><option>Europe/London (GMT)</option></select>
        </div>
      </div>
      <div class="card">
        <div class="card-title"><i class="ti ti-bell-ringing" style="color:#6366f1"></i> Notifications</div>
        <div class="form-row">
          <div><label>Email notifications</label><div class="hint">Receive updates via email</div></div>
          <label class="toggle"><input type="checkbox" checked><div class="toggle-slider"></div></label>
        </div>
        <div class="form-row">
          <div><label>Push notifications</label><div class="hint">Receive in-browser alerts</div></div>
          <label class="toggle"><input type="checkbox"><div class="toggle-slider"></div></label>
        </div>
      </div>
      <div class="card" style="border-color:#fecaca">
        <div class="card-title" style="color:#dc2626"><i class="ti ti-alert-triangle"></i> Danger Zone</div>
        <p style="font-size:12px;color:#64748b;margin-bottom:16px">Permanently delete your account and all associated data. This action cannot be undone.</p>
        <button class="btn btn-danger" onclick="if(confirm('Are you sure?'))alert('Account deleted.')">Delete account</button>
      </div>
    </div>
  </div>
</body>
</html>`,
};

const UIIdeationPage: React.FC = () => {
  const api = useApi();
  const toast = useToast();
  const { project } = useProjectStore();

  // Step state (1: Theme & Sitemap, 2: Live Editor)
  const [step, setStep] = useState<1 | 2>(1);

  // Sitemap & Product State
  const [idea, setIdea] = useState("");
  const [pages, setPages] = useState<PageDefinition[]>([]);
  const [activePageIdx, setActivePageIdx] = useState<number>(0);
  const [isGeneratingSitemap, setIsGeneratingSitemap] = useState(false);

  // Theme Studio State
  const [theme] = useState({
    accent: "#6366F1",
    accentDark: "#4F46E5",
    font: "Space Grotesk",
    radius: 8,
    mode: "light" as "light" | "dark",
  });

  // Editor Viewport & Details
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [fullscreen, setFullscreen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [isGeneratingHTML, setIsGeneratingHTML] = useState(false);
  const [editorCode, setEditorCode] = useState("");
  const [isFallbackTemplate, setIsFallbackTemplate] = useState(false);

  // Chat Agent State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "agent",
      text: "Hi! I'm your AI page agent. Select a page tab, then tell me what to change (e.g. 'Make the header sticky' or 'Apply dark mode') and I'll update the code live.",
    },
  ]);
  const [isSendingChat, setIsSendingChat] = useState(false);

  // Persistence State
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hasLoaded, setHasLoaded] = useState(false);
  const persistRef = useRef({ idea, pages, theme, chatMessages });
  persistRef.current = { idea, pages, theme, chatMessages };

  // Review Workflow State
  const [reviewActive, setReviewActive] = useState(false);
  const [pendingHtml, setPendingHtml] = useState("");
  const [previousHtml, setPreviousHtml] = useState("");
  const [reviewSource, setReviewSource] = useState<"generate" | "chat">("generate");

  // Manual Page Dialog State
  const [showAddPageModal, setShowAddPageModal] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const [newPageTemplate, setNewPageTemplate] = useState("blank");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const themeCssVars = useMemo(() => `
    :root {
      --primary: ${theme.accent} !important;
      --primary-dark: ${theme.accentDark} !important;
      --radius: ${theme.radius}px !important;
      --font: '${theme.font}', sans-serif !important;
    }
    body {
      font-family: '${theme.font}', sans-serif !important;
    }
  `, [theme]);

  const wrapWithTheme = useCallback((html: string): string => {
    if (!html) return html;
    const guardScript = `<script>document.addEventListener('click',function(e){let t=e.target;while(t){if(t.tagName==='A'&&t.href){e.preventDefault();e.stopPropagation();return}if(t.tagName==='IFRAME')return;t=t.parentElement}},true)</script>`;
    const styleHtml = `<style id="sandbox-injected-theme">${themeCssVars}</style>${guardScript}`;
    if (html.includes('</head>')) return html.replace('</head>', `${styleHtml}</head>`);
    if (html.includes('<head>')) return html.replace('<head>', `<head>${styleHtml}`);
    return `<!DOCTYPE html><html><head>${styleHtml}</head><body>${html}</body></html>`;
  }, [themeCssVars]);

  const injectThemeToIframe = () => {
    const iframe = document.getElementById("live-iframe") as HTMLIFrameElement | null;
    if (!iframe || !iframe.contentWindow) return;
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;
    const head = ensureDocumentHead(doc);
    if (!head) return;

    let styleEl = doc.getElementById("sandbox-injected-theme") as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "sandbox-injected-theme";
      head.appendChild(styleEl);
    }
    styleEl.textContent = themeCssVars;
  };

  // Sync injected styles when theme or step changes
  useEffect(() => {
    injectThemeToIframe();
    const timer = setTimeout(injectThemeToIframe, 200);
    return () => clearTimeout(timer);
  }, [theme, step]);

  // Pre-populate product description on project load
  useEffect(() => {
    if (project?.description) {
      setIdea(project.description);
    }
  }, [project]);

  // Dynamic Google Font Injection
  useEffect(() => {
    const mainHead = ensureDocumentHead(document);
    if (!mainHead) return;

    const linkId = "google-fonts-sandbox";
    let linkElement = document.getElementById(linkId) as HTMLLinkElement;
    if (!linkElement) {
      linkElement = document.createElement("link");
      linkElement.id = linkId;
      linkElement.rel = "stylesheet";
      linkElement.href =
        "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=DM+Sans:wght@400;500;600&family=Syne:wght@400;600;700&family=Plus+Jakarta+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
      mainHead.appendChild(linkElement);
    }

    const iconLinkId = "tabler-icons-sandbox";
    let iconLinkElement = document.getElementById(iconLinkId) as HTMLLinkElement;
    if (!iconLinkElement) {
      iconLinkElement = document.createElement("link");
      iconLinkElement.id = iconLinkId;
      iconLinkElement.rel = "stylesheet";
      iconLinkElement.href = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";
      mainHead.appendChild(iconLinkElement);
    }
  }, []);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Auto-load active page HTML when entering Step 2 with empty editor
  useEffect(() => {
    if (step === 2 && pages.length > 0 && !editorCode && !isGeneratingHTML) {
      const activePage = pages[activePageIdx];
      if (activePage?._html) {
        const isStarter = Object.values(STARTER_TEMPLATES).some(
          (tpl) => activePage._html === tpl
        );
        setIsFallbackTemplate(isStarter && !activePage._accepted);
        setEditorCode(activePage._html);
      } else if (activePage) {
        // Trigger generation
        selectPage(activePageIdx);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pages.length]);

  // ── Load sandbox from MongoDB on mount ──
  useEffect(() => {
    if (!project?.id || hasLoaded) return;
    (async () => {
      try {
        const result = await loadSandbox(project.id);
        if (result?.sandbox) {
          const s = result.sandbox;
          if (s.idea) setIdea(s.idea);
          if (s.pages?.length) setPages(s.pages as PageDefinition[]);
          if (s.chatMessages?.length) {
            setChatMessages(s.chatMessages as ChatMessage[]);
          }
          if (s.theme) {
            // Theme is read-only in current state, but we keep the data for future use
          }
        }
      } catch (err) {
        console.error("[UIIdeation] Load sandbox error:", err);
      } finally {
        setHasLoaded(true);
      }
    })();
  }, [project?.id]);

  // ── Auto-save on state changes (debounced) ──
  useEffect(() => {
    if (!hasLoaded || !project?.id) return;
    const data: SandboxData = {
      idea,
      pages,
      theme,
      chatMessages,
    };
    if (!hasSandboxChanges(data)) return;

    setSaveStatus("saving");

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const success = await saveSandbox(project.id, data);
        setSaveStatus(success ? "saved" : "error");
        if (success) {
          setTimeout(() => setSaveStatus((prev) => prev === "saved" ? "idle" : prev), 2000);
        }
      } catch {
        setSaveStatus("error");
      }
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLoaded, project?.id, idea, pages, theme, chatMessages]);

  if (!project) return null;

  // Helpers
  const getThemeDesc = () => {
    return `Primary color: ${theme.accent}. Font: ${theme.font}. Border radius: ${theme.radius}px. Mode: ${theme.mode}.`;
  };

  const forceSave = useCallback(async () => {
    if (!project?.id) return;
    setSaveStatus("saving");
    try {
      const success = await saveSandbox(project.id, {
        idea,
        pages,
        theme,
        chatMessages,
      });
      setSaveStatus(success ? "saved" : "error");
      if (success) setTimeout(() => setSaveStatus((prev) => prev === "saved" ? "idle" : prev), 2000);
    } catch {
      setSaveStatus("error");
    }
  }, [project?.id, idea, pages, theme, chatMessages]);

  // Step 1: Sitemap Generator
  const generatePages = async () => {
    const trimmedIdea = idea.trim();
    if (!trimmedIdea) return;

    setIsGeneratingSitemap(true);
    try {
      if ((project.description || "").trim() !== trimmedIdea) {
        const updatedProject = await api.updateProjectDescription(trimmedIdea, project.id);
        setProject(updatedProject);
      }

      const [pagesResult, structuredPlanResult] = await Promise.allSettled([
        client.post("/ai/sandbox/generate-pages", {
          idea: trimmedIdea,
          projectId: project.id,
        }),
        generateStructuredIdea(trimmedIdea),
      ]);

      if (pagesResult.status !== "fulfilled" || !Array.isArray(pagesResult.value.data)) {
        console.error("Failed to generate sitemap pages", pagesResult.status === "rejected" ? pagesResult.reason : pagesResult.value.data);
        toast.error("Failed to generate the sitemap. Please try again.");
        return;
      }

      setPages(pagesResult.value.data);
      setActivePageIdx(0);
      // Force immediate save after generation
      setTimeout(() => forceSave(), 100);

      // Auto-transition to live editor after sitemap generation
      setStep(2);

      if (structuredPlanResult.status === "rejected") {
        console.error("Failed to generate structured plan", structuredPlanResult.reason);
        toast.warning("Sitemap generated, but the structured plan could not be updated.");
      }
    } catch (err) {
      console.error("Failed to save or analyze product idea", err);
      toast.error("Failed to analyze the product idea. Please try again.");
    } finally {
      setIsGeneratingSitemap(false);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const name = file.name.replace(/\.[^/.]+$/, ""); // strip extension
        const isCss = file.name.endsWith(".css");
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const newPage: PageDefinition = {
          name: name + (isCss ? " (CSS)" : ""),
          path: `/${slug}`,
          type: isCss ? "settings" : "list",
          description: `Uploaded from file: ${file.name}`,
          _html: isCss ? `<style>${text}</style><div style="padding:40px;font-family:sans-serif;"><h2>CSS File Preview</h2><p>This is a raw stylesheet, added as a template block.</p><pre>${text}</pre></div>` : text,
        };

        setPages((prev) => [...prev, newPage]);
      };
      reader.readAsText(file);
    });

    // Reset value
    e.target.value = "";
  };

  const handleCreatePage = () => {
    if (!newPageName.trim()) return;
    const slug = newPageName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    
    // Get starter template code
    const templateHtml = STARTER_TEMPLATES[newPageTemplate] || STARTER_TEMPLATES.blank;
    
    const PAGE_TYPE_MAP: Record<string, string> = {
      blank: "dashboard",
      dashboard: "dashboard",
      landing: "landing",
      auth: "auth",
      settings: "settings",
      list: "list",
    };
    const newPage: PageDefinition = {
      name: newPageName,
      path: `/${slug}`,
      type: PAGE_TYPE_MAP[newPageTemplate] || "list",
      description: `Manual template: ${newPageTemplate}`,
      _html: templateHtml,
    };

    setPages((prev) => [...prev, newPage]);
    setNewPageName("");
    setNewPageTemplate("blank");
    setShowAddPageModal(false);
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
    if (activePageIdx >= pages.length - 1 && activePageIdx > 0) {
      setActivePageIdx(activePageIdx - 1);
    }
  };

  // Step 2: Live HTML Generator & Sync
  const selectPage = async (index: number) => {
    // Cancel any pending review when switching pages
    if (reviewActive) {
      setReviewActive(false);
      setPendingHtml("");
      setPreviousHtml("");
    }
    setActivePageIdx(index);
    const targetPage = pages[index];
    if (!targetPage) return;

    if (targetPage._html) {
      const isStarter = Object.values(STARTER_TEMPLATES).some(
        (tpl) => targetPage._html === tpl
      );
      setIsFallbackTemplate(isStarter && !targetPage._accepted);
      setEditorCode(targetPage._html);
    } else {
      setIsGeneratingHTML(true);
      setIsFallbackTemplate(false);
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      try {
        const res = await client.post("/ai/sandbox/generate-page-html", {
          pageName: targetPage.name,
          pageType: targetPage.type,
          pageDescription: targetPage.description,
          idea,
          themeDesc: getThemeDesc(),
        }, { signal });
        let generatedHtml = res.data.html || "";
        // Fallback to a starter template if the API returned empty
        if (!generatedHtml.trim()) {
          generatedHtml = STARTER_TEMPLATES[targetPage.type] || STARTER_TEMPLATES.blank;
          setIsFallbackTemplate(true);
          toast.warning("AI returned empty content for \"" + targetPage.name + "\". Click \"Generate with AI\" to retry.");
        }
        setPages((prev) => {
          const updated = [...prev];
          if (updated[index]) updated[index]._html = generatedHtml;
          return updated;
        });
        setEditorCode(generatedHtml);
      } catch (err) {
        if (axios.isCancel(err)) return;
        console.error("HTML Generation error", err);
        toast.error("Failed to generate \"" + targetPage.name + "\". Check your AI configuration.");
        // Fallback: use a starter template on error so the iframe isn't blank
        const fallbackHtml: string = STARTER_TEMPLATES[targetPage.type] ?? STARTER_TEMPLATES.blank ?? '';
        setPages((prev) => {
          const updated = [...prev];
          if (updated[index]) updated[index]._html = fallbackHtml;
          return updated;
        });
        setEditorCode(fallbackHtml);
        setIsFallbackTemplate(true);
      } finally {
        setIsGeneratingHTML(false);
      }
    }
  };

  // Force regenerate the current page via AI (activates review mode)
  const forceGeneratePage = async () => {
    const targetPage = pages[activePageIdx];
    if (!targetPage) return;

    setIsFallbackTemplate(false);
    setIsGeneratingHTML(true);

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // If editing a draft that hasn't been accepted yet, skip the review flow
    if (reviewActive) {
      setReviewActive(false);
      setPendingHtml("");
      setPreviousHtml("");
    }

    try {
      const res = await client.post("/ai/sandbox/generate-page-html", {
        pageName: targetPage.name,
        pageType: targetPage.type,
        pageDescription: targetPage.description,
        idea,
        themeDesc: getThemeDesc(),
      }, { signal });
      let generatedHtml = res.data.html || "";
      if (!generatedHtml.trim()) {
        generatedHtml = STARTER_TEMPLATES[targetPage.type] || STARTER_TEMPLATES.blank;
        setIsFallbackTemplate(true);
        toast.warning("AI returned empty content. Try again or use the starter template.");
        // Direct apply for fallback (no review needed for fallbacks)
        setPages((prev) => {
          const updated = [...prev];
          if (updated[activePageIdx]) updated[activePageIdx]._html = generatedHtml;
          return updated;
        });
        setEditorCode(generatedHtml);
      } else {
        // Enter review mode — show generated HTML in preview, wait for accept/discard
        const prev = editorCode || targetPage._html || "";
        setPreviousHtml(prev);
        setPendingHtml(generatedHtml);
        setReviewSource("generate");
        setReviewActive(true);
        // Show in preview immediately
        setEditorCode(generatedHtml);
      }
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error("Force generation error", err);
      toast.error("Failed to generate the page. Check your AI configuration.");
      const fallbackHtml: string = STARTER_TEMPLATES[targetPage.type] ?? STARTER_TEMPLATES.blank ?? '';
      setPages((prev) => {
        const updated = [...prev];
        if (updated[activePageIdx]) updated[activePageIdx]._html = fallbackHtml;
        return updated;
      });
      setEditorCode(fallbackHtml);
      setIsFallbackTemplate(true);
    } finally {
      setIsGeneratingHTML(false);
    }
  };

  const handleNavCta = () => {
    if (pages.length === 0) {
      alert("Please generate or add at least one page first.");
      return;
    }
    setStep(2);
    selectPage(activePageIdx);
  };

  const syncPreview = (newCode: string) => {
    setEditorCode(newCode);
    if (reviewActive) {
      // During review, update pendingHtml instead of committed pages
      setPendingHtml(newCode);
    } else {
      setPages((prev) => {
        const updated = [...prev];
        if (updated[activePageIdx]) updated[activePageIdx]._html = newCode;
        return updated;
      });
    }
  };

  // Step 2: Chat Agent Actions
  const sendChat = async (directMessage?: string) => {
    const msg = (directMessage || chatInput).trim();
    if (!msg) return;
    setChatInput("");

    // Add user message
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: "user", text: msg };
    setChatMessages((prev) => [...prev, userMsg]);

    const activePage = pages[activePageIdx];
    if (!activePage) return;

    setIsSendingChat(true);
    // Add typing loader
    const typingId = `typing-${Date.now()}`;
    setChatMessages((prev) => [...prev, { id: typingId, role: "typing", text: "Working..." }]);

    try {
      const res = await client.post("/ai/sandbox/edit-page", {
        pageName: activePage.name,
        pageType: activePage.type,
        currentHTML: editorCode,
        message: msg,
        themeDesc: getThemeDesc(),
      });

      const responseText = res.data.response || "";
      // Remove typing
      setChatMessages((prev) => prev.filter((m) => m.id !== typingId));

      const splitIdx = responseText.indexOf("|||HTML_START|||");
      if (splitIdx !== -1) {
        const explanation = responseText.slice(0, splitIdx).trim();
        let newHTML = responseText.slice(splitIdx + 16).trim();
        newHTML = newHTML.replace(/```html|```/g, "").trim();

        // Enter review mode — show changes in preview, wait for accept/discard
        const prev = editorCode || pages[activePageIdx]?._html || "";
        setPreviousHtml(prev);
        setPendingHtml(newHTML);
        setReviewSource("chat");
        setReviewActive(true);
        // Show in preview immediately
        setEditorCode(newHTML);

        setChatMessages((prev) => [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", text: explanation, html: newHTML },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", text: responseText },
        ]);
      }
    } catch (err) {
      console.error("Edit page chat error", err);
      setChatMessages((prev) => prev.filter((m) => m.id !== typingId));
      setChatMessages((prev) => [
        ...prev,
        { id: `agent-error-${Date.now()}`, role: "agent", text: "Sorry, I ran into an error trying to apply that change. Please try again." },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleKeydown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  // Review Workflow: Accept / Discard
  const acceptReview = useCallback(() => {
    if (!pendingHtml) return;
    setIsFallbackTemplate(false);
    setEditorCode(pendingHtml);
    setReviewActive(false);
    const updatedPages = pages.map((p, i) =>
      i === activePageIdx ? { ...p, _html: pendingHtml, _accepted: true } : p
    );
    setPages(updatedPages);
    setPendingHtml("");
    setPreviousHtml("");
    setChatMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}`,
        role: "agent",
        text: reviewSource === "generate"
          ? "Changes accepted. The page has been updated with the new design."
          : "Edit accepted. Your feedback has been applied to the page.",
      },
    ]);
    // Immediately save to MongoDB using the computed pages
    if (project?.id) {
      saveSandbox(project.id, { idea, pages: updatedPages, theme, chatMessages }).then((ok) => {
        if (!ok) toast.error("Failed to save accepted changes. Reload and try again.");
      });
    }
  }, [pendingHtml, activePageIdx, idea, pages, theme, chatMessages, project?.id, reviewSource]);

  const discardReview = useCallback(() => {
    const prev = previousHtml || "";
    setEditorCode(prev);
    const isStarter = prev ? Object.values(STARTER_TEMPLATES).some((tpl) => prev === tpl) : true;
    setIsFallbackTemplate(isStarter);
    const updatedPages = pages.map((p, i) =>
      i === activePageIdx ? { ...p, _html: prev, _accepted: !isStarter } : p
    );
    setPages(updatedPages);
    setReviewActive(false);
    setPendingHtml("");
    setPreviousHtml("");
    setChatMessages((prev) => [
      ...prev,
      {
        id: `agent-${Date.now()}`,
        role: "agent",
        text: "Changes discarded. The page has been restored to its previous state.",
      },
    ]);
    // Immediately save to MongoDB using the computed pages
    if (project?.id) {
      saveSandbox(project.id, { idea, pages: updatedPages, theme, chatMessages }).then((ok) => {
        if (!ok) toast.error("Failed to save discarded changes. Reload and try again.");
      });
    }
  }, [previousHtml, activePageIdx, idea, pages, theme, chatMessages, project?.id]);

  // Export Tools
  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCurrentPage = () => {
    if (!editorCode) return;
    const page = pages[activePageIdx];
    const filename = (page?.path.replace(/\//g, "_").replace(/^_/, "") || "page") + ".html";
    downloadFile(editorCode, filename);
  };

  const exportAllPages = () => {
    const generated = pages.filter((p) => p._html);
    if (!generated.length) {
      alert("No pages generated yet.");
      return;
    }
    generated.forEach((p) => {
      downloadFile(p._html || "", (p.path.replace(/\//g, "_").replace(/^_/, "") || "index") + ".html");
    });
  };

  return (
    <div className="ux-sandbox-root" style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Scoped Styles */}
      <style>{`
        .ux-sandbox-root {
          font-family: 'Space Grotesk', var(--ide-font, sans-serif);
          background:
            radial-gradient(circle at top left, rgba(99, 102, 241, 0.12), transparent 28%),
            radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.08), transparent 24%),
            var(--ide-bg);
          color: var(--ide-text);
        }

        /* -- Nav -- */
        .ux-nav {
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 20px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-elevated) 92%, transparent) 0%, color-mix(in srgb, var(--ide-bg-elevated) 84%, transparent) 100%);
          border-bottom: 1px solid var(--ide-border);
          backdrop-filter: blur(18px);
          flex-shrink: 0;
          z-index: 20;
          position: relative;
        }
        .ux-nav-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${theme.accent};
          margin-right: 20px;
        }
        .ux-step {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 7px 14px;
          font-size: 12px;
          font-weight: 600;
          color: var(--ide-text-muted);
          cursor: pointer;
          border-radius: 9999px;
          transition: color 0.15s, background 0.15s, transform 0.15s, border-color 0.15s;
          border: 1px solid transparent;
          background: transparent;
        }
        .ux-step:hover { color: var(--ide-text); background: var(--ide-accent-subtle); transform: translateY(-1px); }
        .ux-step.active {
          color: ${theme.accent};
          background: ${theme.accent}12;
          border-color: ${theme.accent}26;
        }
        .ux-step-num {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          background: var(--ide-accent-subtle);
          color: var(--ide-text-muted);
        }
        .ux-step.active .ux-step-num {
          background: ${theme.accent};
          color: #fff;
        }

        /* -- Buttons -- */
        .ux-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid var(--ide-border);
          background: linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-elevated) 92%, transparent) 0%, var(--ide-bg-elevated) 100%);
          color: var(--ide-text-secondary);
          font-family: inherit;
          box-shadow: var(--ide-shadow-sm);
          transition: background 0.12s, border-color 0.12s, transform 0.12s, box-shadow 0.12s;
        }
        .ux-btn:hover { background: var(--ide-accent-subtle); transform: translateY(-1px); box-shadow: var(--ide-shadow); }
        .ux-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ux-btn.primary {
          background: linear-gradient(135deg, ${theme.accent} 0%, ${theme.accentDark} 100%);
          color: #fff;
          border-color: ${theme.accent};
          box-shadow: 0 12px 28px ${theme.accent}26;
        }
        .ux-btn.primary:hover:not(:disabled) {
          background: linear-gradient(135deg, ${theme.accentDark} 0%, ${theme.accent} 100%);
        }
        .ux-btn.sm { padding: 6px 12px; font-size: 11.5px; }

        /* -- Thinking Dots -- */
        .ux-dots { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ide-text-muted); }
        .ux-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: ${theme.accent};
          animation: ux-dot-anim 0.8s infinite;
        }
        .ux-dot:nth-child(2) { animation-delay: 0.15s; }
        .ux-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes ux-dot-anim {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }

        /* -- Section Headers -- */
        /* -- Step 1 Layout -- */
        .ux-p1 {
          display: grid;
          grid-template-columns: minmax(320px, 372px) minmax(0, 1fr);
          flex: 1;
          overflow: hidden;
          min-height: 0;
          height: 100%;
          gap: 16px;
          padding: 16px;
        }
        .ux-p1-sidebar {
          border: 1px solid var(--ide-border);
          background: linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-sidebar) 92%, transparent) 0%, var(--ide-bg-sidebar) 100%);
          border-radius: 24px;
          box-shadow: var(--ide-shadow);
          overflow-y: auto;
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ux-p1-main {
          border: 1px solid var(--ide-border);
          border-radius: 24px;
          box-shadow: var(--ide-shadow);
          overflow-y: auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background:
            radial-gradient(circle at top right, rgba(99, 102, 241, 0.05), transparent 24%),
            var(--ide-bg);
          height: 100%;
        }

        /* -- Idea Box -- */
        .ux-idea-box {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-panel) 92%, transparent) 0%, var(--ide-bg-panel) 100%);
          border: 1px solid var(--ide-border);
          border-radius: 16px;
          padding: 14px;
          position: relative;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 320px;
        }
        .ux-idea-box textarea {
          width: 100%;
          min-height: 240px;
          padding: 12px 12px 10px;
          background: transparent;
          border: none;
          outline: none;
          font-size: 13.5px;
          color: var(--ide-text);
          font-family: inherit;
          resize: none;
          line-height: 1.7;
          border-radius: 12px;
          caret-color: ${theme.accent};
          flex: 1;
        }
        .ux-idea-box textarea::placeholder { color: var(--ide-text-muted); }

        /* -- Card General -- */
        .ux-card {
          background: linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-elevated) 94%, transparent) 0%, var(--ide-bg-elevated) 100%);
          border: 1px solid var(--ide-border);
          border-radius: 18px;
          box-shadow: var(--ide-shadow-sm);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .ux-card-head {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 13px 16px;
          border-bottom: 1px solid var(--ide-border);
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--ide-text);
        }
        .ux-card-head i { color: var(--ide-text-muted); font-size: 15px; }

        /* -- Sitemap Canvas & visualizer -- */
        .ux-sitemap-canvas {
          background-color: var(--ide-bg-elevated);
          background-image: radial-gradient(var(--ide-border) 1px, transparent 1px);
          background-size: 18px 18px;
          border-radius: 16px;
          border: 1px solid var(--ide-border);
          padding: 18px;
          display: flex;
          gap: 12px;
          overflow-x: auto;
          flex: 1;
          min-height: 480px;
        }
        .ux-sitemap-lane {
          flex: 1;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ux-sitemap-lane-head {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 12px;
          background: var(--ide-bg-sidebar);
          border: 1px solid var(--ide-border);
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          color: var(--ide-text-secondary);
        }
        .ux-sitemap-lane-head i {
          color: ${theme.accent};
          font-size: 12px;
        }
        .ux-sitemap-lane-cards {
          display: flex;
          flex-direction: column;
          gap: 10px;
          flex: 1;
        }
        .ux-sitemap-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ide-text-muted);
          font-size: 13px;
          opacity: 0.5;
        }
        .ux-sitemap-lane-empty {
          border: 0.5px dashed var(--ide-border);
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          color: var(--ide-text-muted);
          font-size: 10.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          background: rgba(0,0,0,0.01);
        }

        /* -- Page Cards -- */
        .ux-page-card {
          border: 1px solid var(--ide-border);
          border-radius: 14px;
          cursor: pointer;
          transition: border-color 0.12s, box-shadow 0.12s, transform 0.12s, background 0.12s;
          position: relative;
          background: linear-gradient(180deg, color-mix(in srgb, var(--ide-bg-elevated) 96%, transparent) 0%, var(--ide-bg-elevated) 100%);
          box-shadow: var(--ide-shadow-sm);
        }
        .ux-page-card:hover {
          border-color: ${theme.accent};
          transform: translateY(-1px);
          box-shadow: 0 8px 20px ${theme.accent}14;
        }
        .ux-page-card.selected {
          border-color: ${theme.accent};
          box-shadow: 0 0 0 3px ${theme.accent}15;
          background: ${theme.accent}06;
        }
        .ux-page-card .pc-remove {
          opacity: 0;
          transition: opacity 0.12s;
        }
        .ux-page-card:hover .pc-remove { opacity: 1; }

        .ux-add-card {
          border: 0.5px dashed var(--ide-border);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 16px;
          min-height: 100px;
          color: var(--ide-text-muted);
          font-size: 11.5px;
          transition: border-color 0.12s, color 0.12s;
          background: transparent;
        }
        .ux-add-card:hover {
          border-color: ${theme.accent};
          color: ${theme.accent};
        }

        /* -- Page Skeleton Generation Screen (theme-aware) -- */
        .ux-skeleton-screen {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          background: linear-gradient(180deg, color-mix(in srgb, ${theme.accent}06, var(--ide-bg-panel) 100%) 0%, var(--ide-bg-panel) 100%);
          color: var(--ide-text-muted);
          font-family: 'JetBrains Mono', monospace;
          padding: 24px;
          overflow: hidden;
        }
        .ux-skeleton-bar {
          height: 8px;
          background: color-mix(in srgb, ${theme.accent}10, var(--ide-border) 80%);
          border-radius: 4px;
          margin-bottom: 8px;
          position: relative;
          overflow: hidden;
        }
        .ux-skeleton-bar::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, ${theme.accent}12, transparent 50%), transparent);
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
        @keyframes skeleton-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* -- Sitemap skeleton (Step 1 generating) -- */
        .ux-sitemap-skeleton {
          display: flex;
          gap: 12px;
          flex: 1;
          min-height: 480px;
          padding: 18px;
          background-color: var(--ide-bg-elevated);
          background-image: radial-gradient(var(--ide-border) 1px, transparent 1px);
          background-size: 18px 18px;
          border-radius: 16px;
          border: 1px solid var(--ide-border);
        }
        .ux-sitemap-skeleton-lane {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 220px;
        }
        .ux-sitemap-skeleton-lane-head {
          height: 42px;
          border-radius: 12px;
          background: color-mix(in srgb, ${theme.accent}08, var(--ide-bg-sidebar) 100%);
          border: 1px solid var(--ide-border);
          position: relative;
          overflow: hidden;
        }
        .ux-sitemap-skeleton-lane-head::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, ${theme.accent}10, transparent 50%), transparent);
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
        .ux-sitemap-skeleton-card {
          height: 110px;
          border-radius: 14px;
          background: color-mix(in srgb, ${theme.accent}04, var(--ide-bg-elevated) 100%);
          border: 1px solid var(--ide-border);
          position: relative;
          overflow: hidden;
        }
        .ux-sitemap-skeleton-card::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, ${theme.accent}08, transparent 50%), transparent);
          animation: skeleton-shimmer 1.8s ease-in-out infinite 0.3s;
        }

        /* -- Progress bar animation -- */
        @keyframes ux-progress-pulse {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
        .ux-progress-bar {
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: transparent;
          overflow: hidden;
        }
        .ux-progress-bar::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent, ${theme.accent}, transparent);
          animation: ux-progress-pulse 1.4s ease-in-out infinite;
          border-radius: 2px;
          box-shadow: 0 0 8px ${theme.accent}40;
        }

        /* -- Step 2 Layout -- */
        .ux-p2 {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          flex: 1;
          overflow: hidden;
          min-height: 0;
          gap: 16px;
          padding: 16px;
        }
        .ux-p2-preview {
          display: flex;
          flex-direction: column;
          border: 1px solid var(--ide-border);
          border-radius: 24px;
          background: var(--ide-bg-elevated);
          overflow: hidden;
        }
        .ux-p2-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-bottom: 1px solid var(--ide-border);
          background: var(--ide-bg-elevated);
          flex-shrink: 0;
        }

        /* Page Tabs */
        .ux-p2-tab {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 5px;
          font-size: 12px;
          color: var(--ide-text-muted);
          cursor: pointer;
          white-space: nowrap;
          border: none;
          background: transparent;
          font-family: inherit;
          transition: all 0.12s;
        }
        .ux-p2-tab:hover:not(.active) {
          color: var(--ide-text-secondary);
          background: var(--ide-accent-subtle);
        }
        .ux-p2-tab.active {
          background: ${theme.accent}14;
          color: ${theme.accent};
          font-weight: 500;
        }

        /* Viewport buttons */
        .ux-vp-btn {
          padding: 5px 7px;
          border-radius: 5px;
          font-size: 13px;
          cursor: pointer;
          border: 0.5px solid var(--ide-border);
          background: transparent;
          color: var(--ide-text-muted);
          font-family: inherit;
          transition: all 0.12s;
        }
        .ux-vp-btn.active {
          background: ${theme.accent}14;
          color: ${theme.accent};
          border-color: transparent;
        }

        /* Preview frame */
        .ux-frame-area {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding: 16px;
          background: var(--ide-canvas-bg);
        }
        .ux-frame-area.desktop { padding: 0; background: #fff; }

        .ux-iframe-desktop { border: none; width: 100%; height: 100%; min-height: 550px; display: block; }
        .ux-iframe-tablet {
          width: 768px; height: 1024px;
          border-radius: 14px;
          box-shadow: var(--ide-shadow);
          border: 8px solid var(--ide-bg-panel);
          background: #fff;
        }
        .ux-iframe-mobile {
          width: 390px; height: 844px;
          border-radius: 24px;
          box-shadow: var(--ide-shadow);
          border: 8px solid var(--ide-bg-panel);
          background: #fff;
        }

        /* Code toggle */
        .ux-code-bar {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-top: 0.5px solid var(--ide-border);
          background: var(--ide-accent-subtle);
          flex-shrink: 0;
        }
        .ux-code-bar span {
          flex: 1;
          font-size: 11px;
          color: var(--ide-text-muted);
          font-family: 'JetBrains Mono', monospace;
        }
        .ux-code-area {
          border-top: 0.5px solid var(--ide-border);
          max-height: 200px;
          flex-shrink: 0;
        }
        .ux-code-area textarea {
          width: 100%;
          height: 160px;
          background: #1e1e2e;
          border: none;
          outline: none;
          padding: 10px 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #cdd6f4;
          resize: none;
          line-height: 1.7;
        }

        /* -- Chat Panel -- */
        .ux-chat {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--ide-bg-elevated);
          border: 1px solid var(--ide-border);
          border-radius: 24px;
        }
        .ux-chat-head {
          padding: 10px 14px;
          border-bottom: 0.5px solid var(--ide-border);
          flex-shrink: 0;
        }
        .ux-agent-badge {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          background: #E1F5EE;
          color: #0F6E56;
          font-weight: 500;
        }
        .ux-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Messages */
        .ux-msg { display: flex; flex-direction: column; gap: 3px; }
        .ux-msg.user { align-items: flex-end; }
        .ux-msg.agent { align-items: flex-start; }
        .ux-msg-bubble {
          max-width: 88%;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 12.5px;
          line-height: 1.55;
        }
        .ux-msg.user .ux-msg-bubble {
          background: ${theme.accent};
          color: #fff;
          border-radius: 10px 10px 2px 10px;
        }
        .ux-msg.agent .ux-msg-bubble {
          background: var(--ide-accent-subtle);
          color: var(--ide-text);
          border: 0.5px solid var(--ide-border);
          border-radius: 10px 10px 10px 2px;
        }
        .ux-msg.typing .ux-msg-bubble {
          background: var(--ide-accent-subtle);
          border: 0.5px solid var(--ide-border);
          border-radius: 10px 10px 10px 2px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--ide-text-muted);
        }
        .ux-msg-meta {
          font-size: 9.5px;
          color: var(--ide-text-muted);
          padding: 0 4px;
        }
        .ux-msg-applied {
          font-size: 10.5px;
          padding: 3px 8px;
          border-radius: 5px;
          background: ${theme.accent}12;
          color: ${theme.accent};
          border: 0.5px solid ${theme.accent}30;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        /* Chips */
        .ux-chip {
          font-size: 11px;
          padding: 4px 10px;
          border-radius: 20px;
          border: 0.5px solid var(--ide-border);
          color: var(--ide-text-secondary);
          background: var(--ide-accent-subtle);
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: border-color 0.12s, color 0.12s;
        }
        .ux-chip:hover {
          border-color: ${theme.accent};
          color: ${theme.accent};
        }
        .ux-chip:disabled { opacity: 0.5; cursor: not-allowed; }

        /* -- Review Panel -- */
        .ux-review-panel { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--ide-bg-elevated); border: 1px solid var(--ide-border); border-radius: 24px; }
        .ux-review-head { padding: 12px 14px; border-bottom: 0.5px solid var(--ide-border); flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
        .ux-review-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; background: #fef3c7; color: #92400e; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .ux-review-head h4 { font-size: 12px; font-weight: 600; color: var(--ide-text); flex: 1; }
        .ux-review-desc { font-size: 11px; color: var(--ide-text-secondary); padding: 8px 14px; line-height: 1.5; border-bottom: 0.5px solid var(--ide-border); flex-shrink: 0; }
        .ux-review-textarea { flex: 1; overflow: hidden; padding: 10px; display: flex; flex-direction: column; }
        .ux-review-textarea label { font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ide-text-muted); margin-bottom: 6px; }
        .ux-review-textarea textarea {
          flex: 1; width: 100%; background: #1a1b26; border: 0.5px solid rgba(255,255,255,0.06); border-radius: 10px;
          padding: 12px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #a9b1d6; resize: none;
          outline: none; line-height: 1.6; tab-size: 2;
        }
        .ux-review-textarea textarea:focus { border-color: ${theme.accent}; }
        .ux-review-actions { display: flex; gap: 8px; padding: 10px 14px; border-top: 0.5px solid var(--ide-border); flex-shrink: 0; }
        .ux-review-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.12s; }
        .ux-review-btn.accept { background: linear-gradient(135deg, #10b981, #059669); color: white; box-shadow: 0 4px 12px rgba(16,185,129,0.3); }
        .ux-review-btn.accept:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(16,185,129,0.4); }
        .ux-review-btn.discard { background: var(--ide-accent-subtle); color: var(--ide-text-secondary); border: 0.5px solid var(--ide-border); }
        .ux-review-btn.discard:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

        /* Review banner on the preview frame */
        .ux-review-banner {
          position: absolute; top: 0; left: 0; right: 0; z-index: 15;
          background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e; padding: 8px 16px;
          display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 500;
          border-bottom: 1px solid rgba(146,64,14,0.1);
        }

        /* Chat Input */
        .ux-chat-input-box {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          background: var(--ide-accent-subtle);
          border: 0.5px solid var(--ide-border);
          border-radius: 10px;
          padding: 7px 10px;
          transition: border-color 0.15s;
        }
        .ux-chat-input-box:focus-within { border-color: ${theme.accent}; }
        .ux-chat-input-box textarea {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          font-size: 12.5px;
          color: var(--ide-text);
          font-family: inherit;
          resize: none;
          line-height: 1.55;
          max-height: 80px;
        }
        .ux-chat-input-box textarea::placeholder { color: var(--ide-text-muted); }
        .ux-chat-send {
          width: 28px;
          height: 28px;
          border-radius: 7px;
          background: ${theme.accent};
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          flex-shrink: 0;
          transition: background 0.12s;
        }
        .ux-chat-send:hover:not(:disabled) { background: ${theme.accentDark}; }
        .ux-chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

        /* -- Modal -- */
        .ux-modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
        }
        .ux-modal-box {
          background: var(--ide-bg-elevated);
          border-radius: 14px;
          padding: 24px;
          width: 400px;
          border: 0.5px solid var(--ide-border);
          box-shadow: var(--ide-shadow);
        }
        .ux-modal-box h3 { font-size: 15px; font-weight: 600; margin-bottom: 6px; color: var(--ide-text); }
        .ux-modal-box p { font-size: 12.5px; color: var(--ide-text-secondary); margin-bottom: 16px; line-height: 1.65; }
        .ux-modal-box input,
        .ux-modal-box select {
          width: 100%;
          border: 0.5px solid var(--ide-border);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 12.5px;
          font-family: inherit;
          outline: none;
          background: var(--ide-accent-subtle);
          color: var(--ide-text);
        }
        .ux-modal-box input:focus,
        .ux-modal-box select:focus { border-color: ${theme.accent}; }
        .ux-modal-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ide-text-muted);
          margin-bottom: 5px;
          display: block;
        }

        /* -- Scrollbar -- */
        .ux-sandbox-root ::-webkit-scrollbar { width: 5px; height: 5px; }
        .ux-sandbox-root ::-webkit-scrollbar-track { background: transparent; }
        .ux-sandbox-root ::-webkit-scrollbar-thumb { background: var(--ide-scrollbar); border-radius: 3px; }
        .ux-sandbox-root ::-webkit-scrollbar-thumb:hover { background: var(--ide-scrollbar-hover); }
      `}</style>

      {/* Hidden File Input for uploading */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".html,.css"
        multiple
        style={{ display: "none" }}
      />

      {/* ── TOP NAV ── */}
      <nav className="ux-nav" style={{ position: "relative" }}>
        {/* Animated progress bar when any operation is running */}
        {(isGeneratingSitemap || isGeneratingHTML || isSendingChat) && (
          <div className="ux-progress-bar" />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          <div className="ux-nav-brand">
            <i className="ti ti-layout-grid" />
            <span>UX Sandbox</span>
          </div>

              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <button onClick={() => setStep(1)} className={`ux-step ${step === 1 ? "active" : ""}`}>
                  <div className="ux-step-num">1</div>
                  <span>Idea & pages</span>
                </button>
            <i className="ti ti-chevron-right" style={{ color: "var(--ide-text-muted)", fontSize: 11, margin: "0 2px" }} />
            <button
              onClick={handleNavCta}
              disabled={pages.length === 0}
              className={`ux-step ${step === 2 ? "active" : ""}`}
            >
              <div className="ux-step-num">2</div>
              <span>Live editor</span>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Save Status Indicator */}
          {saveStatus !== "idle" && !isGeneratingSitemap && !isGeneratingHTML && !isSendingChat && (
            <span style={{
              fontSize: 10.5,
              display: "flex",
              alignItems: "center",
              gap: 4,
              color: saveStatus === "saving" ? "var(--ide-text-muted)"
                : saveStatus === "saved" ? "#10b981"
                : "#ef4444",
              fontWeight: 500,
              transition: "color 0.2s",
            }}>
              <i className={`ti ${saveStatus === "saving" ? "ti-cloud-upload" : saveStatus === "saved" ? "ti-cloud-check" : "ti-cloud-off"}`} />
              {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save failed"}
            </span>
          )}
          {(isGeneratingSitemap || isGeneratingHTML || isSendingChat) && (
            <div className="ux-dots">
              <div className="ux-dot" />
              <div className="ux-dot" />
              <div className="ux-dot" />
              <span style={{ fontWeight: 500 }}>Working…</span>
            </div>
          )}

          {step === 1 ? (
            <button
              onClick={handleNavCta}
              disabled={pages.length === 0}
              className="ux-btn primary"
            >
              <i className="ti ti-arrow-right" />
              <span>Continue to editor</span>
            </button>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={exportCurrentPage} className="ux-btn sm">
                <i className="ti ti-download" />
                <span>Export</span>
              </button>
              <button onClick={exportAllPages} className="ux-btn sm">
                <i className="ti ti-package-export" />
                <span>All</span>
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ══════ STEP 1: THEME STUDIO ══════ */}
      {step === 1 && (
        <div className="ux-p1">
          {/* LEFT: Product idea intake */}
          <div className="ux-p1-sidebar">
            <div className="ux-card" style={{ flex: 1, minHeight: 0 }}>
              <div className="ux-card-head">
                <i className="ti ti-bulb" />
                <span style={{ flex: 1 }}>Product Idea Studio</span>
              </div>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
                <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--ide-text-secondary)" }}>
                  Add the product idea once. The agent will save it, generate the structured plan, and map the sitemap in one click.
                </div>
                <div className="ux-idea-box">
                  <textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder="Describe your product… e.g. 'A SaaS invoicing tool for freelance designers'"
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 8 }}>
                    <div style={{ fontSize: 10.5, lineHeight: 1.5, color: "var(--ide-text-muted)", maxWidth: 180 }}>
                      {project.settings?.ideaDetails
                        ? "The structured plan will be refreshed from this idea."
                        : "The structured plan will be created automatically."}
                    </div>
                    <button
                      onClick={generatePages}
                      disabled={isGeneratingSitemap || !idea.trim()}
                      className="ux-btn primary sm"
                    >
                      <i className="ti ti-wand" />
                      <span>{isGeneratingSitemap ? "Analyzing…" : "Analyze idea"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Visual Sitemap Canvas */}
          <div className="ux-p1-main">
            <div className="ux-card" style={{ flex: 1 }}>
              <div className="ux-card-head">
                <i className="ti ti-layout-2" />
                <span style={{ flex: 1 }}>
                  Sitemap Architecture <span style={{ fontWeight: 400, color: "var(--ide-text-muted)", fontSize: 11.5 }}>({pages.length} pages structured)</span>
                </span>
                <button onClick={triggerFileUpload} className="ux-btn sm">
                  <i className="ti ti-file-upload" />
                  <span>Upload HTML/CSS</span>
                </button>
              </div>

              <div style={{ padding: 16, display: "flex", flex: 1, flexDirection: "column", minHeight: 0 }}>
                {pages.length === 0 && isGeneratingSitemap ? (
                  <div className="ux-sitemap-skeleton">
                    <div className="ux-sitemap-skeleton-lane">
                      <div className="ux-sitemap-skeleton-lane-head" />
                      <div className="ux-sitemap-skeleton-card" />
                      <div className="ux-sitemap-skeleton-card" />
                    </div>
                    <div className="ux-sitemap-skeleton-lane">
                      <div className="ux-sitemap-skeleton-lane-head" />
                      <div className="ux-sitemap-skeleton-card" />
                    </div>
                    <div className="ux-sitemap-skeleton-lane">
                      <div className="ux-sitemap-skeleton-lane-head" />
                      <div className="ux-sitemap-skeleton-card" />
                      <div className="ux-sitemap-skeleton-card" />
                    </div>
                    <div className="ux-sitemap-skeleton-lane" style={{ minWidth: 100, justifyContent: "center" }}>
                      <div style={{ height: 100, borderRadius: 8, background: "color-mix(in srgb, var(--ide-border) 50%, transparent)", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--ide-border) 60%, transparent), transparent)", animation: "skeleton-shimmer 1.8s ease-in-out infinite 0.6s" }} />
                      </div>
                    </div>
                  </div>
                ) : pages.length === 0 ? (
                  <div style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    border: "0.5px dashed var(--ide-border)",
                    borderRadius: 10,
                    padding: 40,
                    color: "var(--ide-text-muted)",
                    textAlign: "center",
                    background: "rgba(0,0,0,0.01)"
                  }}>
                    <i className="ti ti-route" style={{ fontSize: 36, color: "var(--ide-text-muted)", opacity: 0.5 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ide-text)" }}>No pages in sitemap</div>
                    <div style={{ fontSize: 12, maxWidth: 300, lineHeight: 1.5 }}>
                      Describe your product idea on the left and click "Analyze idea" to build the sitemap. The structured plan is updated automatically in the workshop.
                    </div>
                  </div>
                ) : (
                  <div className="ux-sitemap-canvas">
                    {SITEMAP_LANES.map((lane, laneIdx) => {
                      // Filter pages belonging to this lane
                      const lanePages = pages
                        .map((p, idx) => ({ ...p, originalIdx: idx }))
                        .filter((p) => {
                          if (lane.id === "utilities") {
                            // Catch-all for utility types or types not covered by other lanes
                            return !SITEMAP_LANES.some(l => l.id !== "utilities" && l.types.includes(p.type)) || lane.types.includes(p.type);
                          }
                          return lane.types.includes(p.type);
                        });

                      return (
                        <React.Fragment key={lane.id}>
                          <div className="ux-sitemap-lane">
                            <div className="ux-sitemap-lane-head">
                              <i className={`ti ${lane.icon}`} />
                              <span>{lane.label}</span>
                              <span style={{ marginLeft: "auto", fontSize: 9.5, opacity: 0.6, background: "var(--ide-border)", padding: "1px 5px", borderRadius: 10 }}>
                                {lanePages.length}
                              </span>
                            </div>

                            <div className="ux-sitemap-lane-cards">
                              {lanePages.map((p) => (
                                <div
                                  key={p.originalIdx}
                                  className={`ux-page-card ${activePageIdx === p.originalIdx ? "selected" : ""}`}
                                  onClick={() => setActivePageIdx(p.originalIdx)}
                                  style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
                                >
                                  {/* Card Header */}
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: 6,
                                      background: `${theme.accent}12`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      color: theme.accent, fontSize: 13, flexShrink: 0
                                    }}>
                                      <i className={`ti ${PAGE_ICONS[p.type] || "ti-file"}`} />
                                    </div>
                                    <div style={{ flex: 1, overflow: "hidden" }}>
                                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ide-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {p.name}
                                      </div>
                                      <div style={{ fontSize: 9.5, color: theme.accent, fontFamily: "monospace", marginTop: 1 }}>
                                        {p.path}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Card Description */}
                                  {p.description && (
                                    <div style={{
                                      fontSize: 10,
                                      color: "var(--ide-text-secondary)",
                                      lineHeight: 1.4,
                                      opacity: 0.8,
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis"
                                    }}>
                                      {p.description}
                                    </div>
                                  )}

                                  {/* Status indicator & preview CTAs */}
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4, borderTop: "0.5px solid var(--ide-border)", paddingTop: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <span style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: p._html && !Object.values(STARTER_TEMPLATES).includes(p._html) ? "#10b981" : "#f59e0b"
                                      }} />
                                      <span style={{ fontSize: 9.5, color: "var(--ide-text-muted)" }}>
                                        {p._html && !Object.values(STARTER_TEMPLATES).includes(p._html) ? "AI Compiled" : "Starter Draft"}
                                      </span>
                                    </div>

                                    {p._html && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setStep(2);
                                          selectPage(p.originalIdx);
                                        }}
                                        className="ux-btn sm"
                                        style={{ padding: "2px 6px", fontSize: 9.5, borderRadius: 4, background: "var(--ide-accent-subtle)" }}
                                        title="Preview and Edit Page"
                                      >
                                        <i className="ti ti-eye" />
                                        <span>Preview</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Hover Delete */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePage(p.originalIdx);
                                    }}
                                    className="pc-remove"
                                    style={{
                                      position: "absolute",
                                      top: 4,
                                      right: 4,
                                      width: 16,
                                      height: 16,
                                      background: "var(--ide-bg-elevated)",
                                      border: "0.5px solid var(--ide-border)",
                                      borderRadius: "50%",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 9,
                                      cursor: "pointer",
                                      color: "var(--ide-text-secondary)",
                                    }}
                                  >
                                    <i className="ti ti-x" />
                                  </button>
                                </div>
                              ))}

                              {/* Lane specific add placeholder */}
                              {lanePages.length === 0 && (
                                <div className="ux-sitemap-lane-empty">
                                  No {lane.label.toLowerCase()}
                                </div>
                              )}
                            </div>
                          </div>

                          {laneIdx < SITEMAP_LANES.length - 1 && (
                            <div className="ux-sitemap-arrow">
                              <i className="ti ti-arrow-narrow-right" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Standard add page card at sitemap level */}
                    <div className="ux-sitemap-lane" style={{ minWidth: 100, justifyContent: "center" }}>
                      <button onClick={() => setShowAddPageModal(true)} className="ux-add-card">
                        <i className="ti ti-plus" style={{ fontSize: 16 }} />
                        <span>Add Page</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ STEP 2: LIVE EDITOR + CHAT ══════ */}
      {step === 2 && (
        <div className="ux-p2">
          {/* LEFT: Preview */}
          <div className="ux-p2-preview">
            <div className="ux-p2-toolbar">
              <div style={{ display: "flex", gap: 1, overflow: "auto", flex: 1, scrollbarWidth: "none" }}>
                {pages.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => selectPage(i)}
                    className={`ux-p2-tab ${activePageIdx === i ? "active" : ""}`}
                  >
                    <i className={`ti ${PAGE_ICONS[p.type] || "ti-file"}`} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                {[
                  { id: "desktop" as const, icon: "ti-device-desktop" },
                  { id: "tablet" as const, icon: "ti-device-tablet" },
                  { id: "mobile" as const, icon: "ti-device-mobile" },
                ].map((vp) => (
                  <button
                    key={vp.id}
                    onClick={() => setViewport(vp.id)}
                    className={`ux-vp-btn ${viewport === vp.id ? "active" : ""}`}
                    title={vp.id}
                  >
                    <i className={`ti ${vp.icon}`} />
                  </button>
                ))}
              </div>

              <button
                onClick={() => setFullscreen(v => !v)}
                className="ux-btn sm"
                title="Fullscreen preview"
              >
                <i className={`ti ${fullscreen ? "ti-arrows-minimize" : "ti-arrows-maximize"}`} />
              </button>

              <button
                onClick={forceGeneratePage}
                disabled={isGeneratingHTML}
                className="ux-btn sm"
                title="Regenerate page with AI"
              >
                <i className="ti ti-refresh" />
                Regenerate
              </button>

              <button onClick={exportCurrentPage} className="ux-btn sm">
                <i className="ti ti-download" />
                Export
              </button>
            </div>

            {/* Iframe Preview */}
            <div className={`ux-frame-area ${viewport === "desktop" ? "desktop" : ""}`} style={{ position: "relative" }}>
              {isGeneratingHTML ? (
                <div className="ux-skeleton-screen" style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Mock Navbar (theme-aware) */}
                  <div style={{
                    height: 48,
                    background: "color-mix(in srgb, var(--ide-border) 40%, transparent)",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 16px",
                    border: "0.5px solid var(--ide-border)"
                  }}>
                    <div className="ux-skeleton-bar" style={{ width: 80, height: 10, margin: 0 }} />
                    <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
                      <div className="ux-skeleton-bar" style={{ width: 40, height: 8, margin: 0 }} />
                      <div className="ux-skeleton-bar" style={{ width: 40, height: 8, margin: 0 }} />
                    </div>
                  </div>

                  {/* Mock Workspace Content (theme-aware) */}
                  <div style={{ flex: 1, display: "flex", gap: 16 }}>
                    {/* Mock Sidebar */}
                    <div style={{
                      width: 140,
                      background: "color-mix(in srgb, var(--ide-border) 20%, transparent)",
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      border: "0.5px solid var(--ide-border)"
                    }}>
                      <div className="ux-skeleton-bar" style={{ width: "70%", height: 8 }} />
                      <div className="ux-skeleton-bar" style={{ width: "50%", height: 8 }} />
                      <div className="ux-skeleton-bar" style={{ width: "60%", height: 8 }} />
                      <div className="ux-skeleton-bar" style={{ width: "40%", height: 8 }} />
                    </div>

                    {/* Mock Main Area */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                      {/* Metric widgets skeleton (theme-aware) */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                        {[40, 30, 50].map((w, i) => (
                          <div key={i} style={{
                            height: 64,
                            background: "color-mix(in srgb, var(--ide-border) 20%, transparent)",
                            border: "0.5px solid var(--ide-border)",
                            borderRadius: 8,
                            padding: 12
                          }}>
                            <div className="ux-skeleton-bar" style={{ width: `${w}%`, height: 6 }} />
                            <div className="ux-skeleton-bar" style={{ width: `${w + 20}%`, height: 12, marginTop: 8 }} />
                          </div>
                        ))}
                      </div>

                      {/* Main Table skeleton (theme-aware) */}
                      <div style={{
                        flex: 1,
                        background: "color-mix(in srgb, var(--ide-border) 15%, transparent)",
                        border: "0.5px solid var(--ide-border)",
                        borderRadius: 8,
                        padding: 16,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12
                      }}>
                        <div className="ux-skeleton-bar" style={{ width: "20%", height: 10 }} />
                        <div style={{ borderBottom: "0.5px solid var(--ide-border)", paddingBottom: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "100%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "95%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "98%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "92%", height: 8 }} />
                        <div className="ux-skeleton-bar" style={{ width: "88%", height: 8 }} />
                      </div>
                    </div>
                  </div>

                  {/* AI Status Banner overlay — based on theme */}
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "color-mix(in srgb, var(--ide-bg) 80%, transparent)",
                    backdropFilter: "blur(6px)"
                  }}>
                    <div style={{
                      background: "var(--ide-bg-elevated)",
                      border: "1px solid var(--ide-border)",
                      borderRadius: 16,
                      padding: "24px 36px",
                      textAlign: "center",
                      boxShadow: "var(--ide-shadow-premium, var(--ide-shadow))",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 12,
                      maxWidth: 320,
                    }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: `color-mix(in srgb, ${theme.accent}15, transparent)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        color: theme.accent,
                      }}>
                        <i className="ti ti-sparkles" />
                      </div>
                      <div className="ux-dots" style={{ fontSize: 16, gap: 5 }}>
                        <div className="ux-dot" style={{ width: 6, height: 6 }} />
                        <div className="ux-dot" style={{ width: 6, height: 6 }} />
                        <div className="ux-dot" style={{ width: 6, height: 6 }} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ide-text)" }}>
                        Building page with AI
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--ide-text-secondary)", lineHeight: 1.5 }}>
                        Applying your design tokens, generating content, and compiling the layout&hellip;
                      </div>
                      <button
                        onClick={() => {
                          abortControllerRef.current?.abort();
                          setIsGeneratingHTML(false);
                        }}
                        style={{
                          marginTop: 8,
                          padding: "8px 20px",
                          borderRadius: 8,
                          border: "0.5px solid var(--ide-border)",
                          background: "var(--ide-bg)",
                          color: "var(--ide-text-secondary)",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Review banner — shown when changes are pending review */}
                  {reviewActive && (
                    <div className="ux-review-banner">
                      <i className="ti ti-eye" style={{ fontSize: 14 }} />
                      <span>Pending review — changes are shown but not yet saved. Review in the sidebar.</span>
                    </div>
                  )}
                  <iframe
                    id="live-iframe"
                    srcDoc={wrapWithTheme(editorCode)}
                    onLoad={injectThemeToIframe}
                    className={
                      viewport === "desktop"
                        ? "ux-iframe-desktop"
                        : viewport === "tablet"
                        ? "ux-iframe-tablet"
                        : "ux-iframe-mobile"
                    }
                    sandbox="allow-scripts allow-same-origin"
                    style={{ border: "none" }}
                  />

                  {/* Generate with AI overlay — shown when displaying a fallback template */}
                  {isFallbackTemplate && !reviewActive && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      background: "rgba(0,0,0,0.35)",
                      backdropFilter: "blur(3px)",
                      zIndex: 10,
                    }}>
                      <div style={{
                        background: "var(--ide-bg-elevated)",
                        borderRadius: 14,
                        padding: "28px 36px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 14,
                        border: "0.5px solid var(--ide-border)",
                        boxShadow: "var(--ide-shadow)",
                        maxWidth: 340,
                        textAlign: "center",
                      }}>
                        <i className="ti ti-wand" style={{ fontSize: 28, color: theme.accent }} />
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ide-text)" }}>
                          Generate this page with AI
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--ide-text-secondary)", lineHeight: 1.55 }}>
                          Currently showing a starter template. Click below to generate a full, production-quality page tailored to your project.
                        </div>
                        <button
                          onClick={forceGeneratePage}
                          disabled={isGeneratingHTML}
                          className="ux-btn primary"
                          style={{ marginTop: 4, padding: "9px 22px", fontSize: 13 }}
                        >
                          <i className="ti ti-sparkles" />
                          <span>Generate with AI</span>
                        </button>
                        <button
                          onClick={() => setIsFallbackTemplate(false)}
                          className="ux-btn sm"
                          style={{ fontSize: 11 }}
                        >
                          Use starter template instead
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Fullscreen preview overlay */}
            {fullscreen && (
              <div style={{
                position: "fixed", inset: 0, zIndex: 9999, background: "var(--ide-bg)",
                display: "flex", flexDirection: "column",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 16px", borderBottom: "0.5px solid var(--ide-border)",
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ide-text-secondary)" }}>
                    Preview · {pages[activePageIdx]?.name || "Page"}
                  </span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {[
                      { id: "desktop" as const, icon: "ti-device-desktop" },
                      { id: "tablet" as const, icon: "ti-device-tablet" },
                      { id: "mobile" as const, icon: "ti-device-mobile" },
                    ].map((vp) => (
                      <button
                        key={vp.id}
                        onClick={() => setViewport(vp.id)}
                        className={`ux-vp-btn ${viewport === vp.id ? "active" : ""}`}
                        title={vp.id}
                        style={{ width: 28, height: 28, fontSize: 14 }}
                      >
                        <i className={`ti ${vp.icon}`} />
                      </button>
                    ))}
                    <button
                      onClick={() => setFullscreen(false)}
                      style={{
                        background: "none", border: "0.5px solid var(--ide-border)", borderRadius: 6,
                        color: "var(--ide-text)", cursor: "pointer", width: 28, height: 28,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                      }}
                      title="Exit fullscreen"
                    >
                      <i className="ti ti-x" />
                    </button>
                  </div>
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <iframe
                    srcDoc={wrapWithTheme(editorCode)}
                    onLoad={injectThemeToIframe}
                    sandbox="allow-scripts allow-same-origin"
                    style={{
                      border: "none",
                      width: viewport === "mobile" ? 375 : viewport === "tablet" ? 768 : "100%",
                      height: "100%",
                      maxWidth: viewport === "desktop" ? "100%" : undefined,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Code toggle */}
            <div className="ux-code-bar">
              <i className="ti ti-code" style={{ fontSize: 13, color: "var(--ide-text-muted)" }} />
              <span>
                {(pages[activePageIdx]?.path.replace(/\//g, "_").replace(/^_/, "") || "index") + ".html"}
              </span>
              <button onClick={() => setShowCode(!showCode)} className="ux-btn sm">
                <i className={`ti ${showCode ? "ti-chevron-down" : "ti-chevron-up"}`} />
                HTML
              </button>
            </div>
            {showCode && (
              <div className="ux-code-area">
                <textarea
                  value={editorCode}
                  onChange={(e) => syncPreview(e.target.value)}
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* RIGHT: Chat Agent / Review Panel */}
          {reviewActive ? (
            <div className="ux-review-panel">
              <div className="ux-review-head">
                <i className="ti ti-eye" style={{ color: "#f59e0b", fontSize: 16 }} />
                <h4>Review Changes</h4>
                <span className="ux-review-badge">Pending</span>
              </div>
              <div className="ux-review-desc">
                {reviewSource === "generate"
                  ? "AI generated a new design for this page. Review the code below, then accept or discard."
                  : "AI has edited this page based on your request. Review the changes, then accept or discard."
                }
              </div>
              <div className="ux-review-textarea">
                <label>Pending HTML <span style={{ fontWeight: 400, textTransform: "none" }}>(you can edit directly)</span></label>
                <textarea
                  value={pendingHtml}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPendingHtml(v);
                    setEditorCode(v);
                  }}
                  spellCheck={false}
                />
              </div>
              <div className="ux-review-actions">
                <button className="ux-review-btn discard" onClick={discardReview}>
                  <i className="ti ti-x" /> Discard
                </button>
                <button className="ux-review-btn accept" onClick={acceptReview}>
                  <i className="ti ti-check" /> Accept
                </button>
              </div>
            </div>
          ) : (
            <div className="ux-chat">
              <div className="ux-chat-head">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: "var(--ide-text)" }}>AI Page Agent</span>
                  <span className="ux-agent-badge">Active</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ide-text-muted)" }}>
                  {pages[activePageIdx]
                    ? `Editing: ${pages[activePageIdx].name} (${pages[activePageIdx].path})`
                    : "No page loaded"}
                </div>
              </div>

              {/* Messages */}
              <div className="ux-chat-messages">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`ux-msg ${msg.role}`}>
                    <div className="ux-msg-bubble">
                      {msg.role === "typing" ? (
                        <>
                          <div className="ux-dots" style={{ gap: 3 }}>
                            <div className="ux-dot" />
                            <div className="ux-dot" />
                            <div className="ux-dot" />
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 500 }}>Agent is applying changes</span>
                        </>
                      ) : (
                        msg.text
                      )}
                    </div>
                    {msg.role === "agent" && msg.html && (
                      <div style={{ marginTop: 4 }}>
                        <span className="ux-msg-applied">
                          <i className="ti ti-check" style={{ fontSize: 11 }} />
                          Applied to Preview
                        </span>
                      </div>
                    )}
                    <div className="ux-msg-meta">
                      {msg.role === "user" ? "You" : msg.role === "typing" ? "" : "Agent"}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Quick chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: "6px 12px", borderTop: "0.5px solid var(--ide-border)", flexShrink: 0 }}>
                {[
                  { label: "Sticky header", text: "Make the header sticky and add a shadow" },
                  { label: "Dark sidebar", text: "Add a dark sidebar navigation" },
                  { label: "Mobile layout", text: "Make it fully responsive for mobile" },
                  { label: "Notifications", text: "Add a notifications bell with a badge" },
                  { label: "Apply theme", text: "Change the color scheme to match my theme" },
                  { label: "More content", text: "Add more realistic sample data and content" },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => sendChat(chip.text)}
                    disabled={isSendingChat}
                    className="ux-chip"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: "8px 12px", borderTop: "0.5px solid var(--ide-border)", flexShrink: 0 }}>
                <div className="ux-chat-input-box">
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={handleKeydown}
                    placeholder="Ask the agent to edit this page…"
                    rows={1}
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={isSendingChat || !chatInput.trim()}
                    className="ux-chat-send"
                  >
                    <i className="ti ti-arrow-up" style={{ fontSize: 13 }} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ADD PAGE MODAL ── */}
      {showAddPageModal && (
        <div className="ux-modal-bg">
          <div className="ux-modal-box">
            <h3>Add a page</h3>
            <p>Create a new page from a starter template or a blank canvas.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              <div>
                <label className="ux-modal-label">Page title</label>
                <input
                  type="text"
                  value={newPageName}
                  onChange={(e) => setNewPageName(e.target.value)}
                  placeholder="e.g. Pricing, User Profile"
                />
              </div>
              <div>
                <label className="ux-modal-label">Template</label>
                <select
                  value={newPageTemplate}
                  onChange={(e) => setNewPageTemplate(e.target.value)}
                >
                  <option value="blank">Blank canvas</option>
                  <option value="dashboard">Overview dashboard</option>
                  <option value="landing">Product landing page</option>
                  <option value="auth">Sign in / Sign up</option>
                  <option value="settings">Settings panel</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => {
                  setShowAddPageModal(false);
                  setNewPageName("");
                }}
                className="ux-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePage}
                disabled={!newPageName.trim()}
                className="ux-btn primary"
              >
                Add page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UIIdeationPage;
