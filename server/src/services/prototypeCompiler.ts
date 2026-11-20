/**
 * Connected Multi-Page Prototype Compiler
 *
 * Generates genuinely interactive, live-API-wired HTML screens for every page in an Akasha project.
 * - ZERO `alert()` dead buttons
 * - Every screen calls the project's Live Stateful Mock API (`/api/mock/:projectId/:resource`)
 * - Clicking nav links switches pages seamlessly via postMessage (`akasha-navigate`) so founders,
 *   designers, and clients can test real end-to-end flows (Storefront -> Cart -> Checkout -> Orders)
 *   on Day 1.
 */

import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';

export interface CompiledPrototypePage {
    id: string;
    name: string;
    path: string;
    pageType: string;
    primaryEntity?: string;
    description: string;
    html: string;
}

export interface CompiledPrototypeManifest {
    projectId: string;
    projectName: string;
    projectDescription: string;
    archetype?: string;
    accentColor: string;
    mockApiBase: string;
    shareEnabled: boolean;
    shareToken?: string;
    pages: CompiledPrototypePage[];
    comments: any[];
}

function escapeHtml(str: string = ''): string {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function inferResourceForModel(model: any, fallback = 'items'): string {
    if (!model) return fallback;
    const schema = safeJsonParse<Record<string, any>>(model.schema, {});
    if (schema.resource) return String(schema.resource).toLowerCase();
    return `${String(model.name || fallback).toLowerCase()}s`;
}

function extractModelFields(model: any): Array<{ name: string; field_type: string; required: boolean }> {
    if (!model) {
        return [
            { name: 'title', field_type: 'string', required: true },
            { name: 'status', field_type: 'string', required: true },
        ];
    }
    const schema = safeJsonParse<{ fields?: any[] }>(model.schema, {});
    const raw = Array.isArray(schema.fields) ? schema.fields : [];
    return raw
        .filter((f: any) => f.name && f.name !== 'id' && f.name !== 'createdAt' && f.name !== 'updatedAt' && f.name !== 'timestamp' && f.name !== 'items')
        .map((f: any) => ({
            name: String(f.name),
            field_type: String(f.field_type || 'string'),
            required: f.required !== false,
        }));
}

function renderInteractiveHtml(params: {
    projectId: string;
    projectName: string;
    accentColor: string;
    page: { id: string; name: string; path: string; pageType: string; description: string; primaryEntity?: string };
    allPages: Array<{ id: string; name: string; path: string; pageType: string }>;
    primaryModel: any;
    allModels: any[];
}): string {
    const { projectId, projectName, accentColor, page, allPages, primaryModel, allModels } = params;
    const resource = inferResourceForModel(primaryModel, 'items');
    const modelName = primaryModel?.name || 'Record';
    const fields = extractModelFields(primaryModel);
    const hasCart = allModels.some((m: any) => inferResourceForModel(m) === 'cart');
    const hasOrders = allModels.some((m: any) => inferResourceForModel(m) === 'orders');
    const mockBase = `/api/mock/${encodeURIComponent(projectId)}`;

    const navHtml = allPages.map((p) => {
        const active = p.path === page.path ? 'active' : '';
        return `<button class="nav-link ${active}" onclick="akashaNavigate('${escapeHtml(p.path)}')">${escapeHtml(p.name)}</button>`;
    }).join('');

    const cartBadgeHtml = hasCart
        ? `<button class="cart-pill" onclick="akashaNavigate('/checkout')">Cart <span id="cartCount">0</span></button>`
        : '';

    const pageType = page.pageType || 'list';
    const fieldsJson = JSON.stringify(fields);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.name)} — ${escapeHtml(projectName)}</title>
  <style>
    :root {
      --accent: ${escapeHtml(accentColor)};
      --bg: #e7eaef;
      --surface: #f7f8fa;
      --surface-2: #dde2ea;
      --border: #c9d1dd;
      --text: #0b1220;
      --muted: #2f3d52;
      --radius: 14px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      background-image: radial-gradient(circle at 1px 1px, rgba(11,18,32,0.055) 1px, transparent 0);
      background-size: 24px 24px;
      color: var(--text);
      min-height: 100vh;
    }
    .topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 24px; background: rgba(238,240,244,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
    .brand { font-weight: 800; font-size: 15px; display: flex; align-items: center; gap: 10px; color: var(--text); }
    .brand-dot { width: 10px; height: 10px; border-radius: 999px; background: var(--accent); }
    .nav { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .nav-link { background: transparent; border: 1px solid transparent; color: var(--muted); padding: 7px 12px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.15s; }
    .nav-link:hover { color: var(--text); background: var(--surface-2); }
    .nav-link.active { color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, transparent); border-color: color-mix(in srgb, var(--accent) 28%, transparent); }
    .cart-pill { background: var(--accent); color: #fff; border: none; padding: 7px 14px; border-radius: 10px; font-size: 12.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .cart-pill span { background: rgba(255,255,255,0.22); padding: 1px 7px; border-radius: 999px; font-size: 11px; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 24px 64px; display: flex; flex-direction: column; gap: 22px; }
    .hero { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .hero h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.025em; color: var(--text); }
    .hero p { color: var(--muted); font-size: 14px; margin-top: 6px; max-width: 680px; line-height: 1.5; }
    .btn { padding: 9px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; transition: 0.15s; }
    .btn:hover { background: var(--surface-2); }
    .btn-primary { background: var(--accent); border-color: transparent; color: #fff; }
    .btn-primary:hover { filter: brightness(0.95); background: var(--accent); }
    .btn-danger { background: #fef3f2; border-color: #fecdca; color: #b42318; }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; display: flex; flex-direction: column; gap: 10px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .kpi-val { font-size: 28px; font-weight: 800; margin-top: 4px; color: var(--text); }
    .kpi-label { font-size: 12px; color: var(--muted); font-weight: 600; }
    .badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--surface-2); color: var(--muted); width: fit-content; }
    .badge-ok { background: #ecfdf3; color: #027a48; }
    .badge-warn { background: #fffaeb; color: #b54708; }
    .badge-bad { background: #fef3f2; color: #b42318; }
    .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .input { background: var(--surface); border: 1px solid var(--border); color: var(--text); border-radius: 10px; padding: 9px 13px; font-size: 13px; outline: none; }
    .input:focus { border-color: var(--accent); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; font-size: 12px; color: var(--muted); padding: 12px 14px; border-bottom: 1px solid var(--border); background: #f9fafb; font-weight: 600; }
    td { padding: 12px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
    .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .split { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; }
    @media (max-width: 820px) { .split { grid-template-columns: 1fr; } }
    .form-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
    .form-field label { font-size: 12px; font-weight: 600; color: var(--muted); }
    .toast { position: fixed; bottom: 20px; right: 20px; background: #101828; color: #fff; padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 600; box-shadow: 0 12px 32px rgba(16,24,40,0.22); opacity: 0; transform: translateY(10px); transition: 0.2s; pointer-events: none; z-index: 60; }
    .toast.show { opacity: 1; transform: translateY(0); }
    .modal-bg { display: none; position: fixed; inset: 0; background: rgba(16,24,40,0.4); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 50; padding: 16px; }
    .modal-bg.open { display: flex; }
    .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 460px; padding: 22px; box-shadow: 0 20px 48px rgba(16,24,40,0.16); }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="brand-dot"></span>
      <span>${escapeHtml(projectName)}</span>
      <span class="badge badge-ok">Live Mock API</span>
    </div>
    <nav class="nav">
      ${navHtml}
      ${cartBadgeHtml}
    </nav>
  </header>

  <main id="appRoot">
    <div class="hero">
      <div>
        <h1>${escapeHtml(page.name)}</h1>
        <p>${escapeHtml(page.description || `Interactive live view connected to ${mockBase}/${resource}`)}</p>
      </div>
      <div id="heroActions"></div>
    </div>
    <div id="viewBody"><div class="card">Loading live data from <code>${escapeHtml(mockBase)}/${escapeHtml(resource)}</code>...</div></div>
  </main>

  <div class="modal-bg" id="createModal">
    <div class="modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="font-size:16px;font-weight:800;">New ${escapeHtml(modelName)}</h3>
        <button class="btn" style="padding:4px 10px;" onclick="closeCreateModal()">✕</button>
      </div>
      <form id="createForm"></form>
    </div>
  </div>

  <div class="toast" id="toastEl"></div>

  <script>
    const MOCK_BASE = ${JSON.stringify(mockBase)};
    const RESOURCE = ${JSON.stringify(resource)};
    const MODEL_NAME = ${JSON.stringify(modelName)};
    const PAGE_TYPE = ${JSON.stringify(pageType)};
    const HAS_CART = ${JSON.stringify(hasCart)};
    const HAS_ORDERS = ${JSON.stringify(hasOrders)};
    const FIELDS = ${fieldsJson};

    function akashaNavigate(targetPath) {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'akasha-navigate', path: targetPath }, '*');
      } else {
        window.location.hash = targetPath;
      }
    }

    function showToast(msg) {
      const el = document.getElementById('toastEl');
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(window.__toastTimer);
      window.__toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
    }

    async function apiFetch(subpath, opts = {}) {
      const res = await fetch(MOCK_BASE + subpath, {
        headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
        ...opts,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.details ? json.details.join(', ') : (json.error || 'Request failed'));
      return json;
    }

    async function refreshCartCount() {
      if (!HAS_CART) return;
      try {
        const res = await apiFetch('/cart');
        const total = (res.data || []).reduce((sum, item) => sum + Number(item.quantity || 1), 0);
        const badge = document.getElementById('cartCount');
        if (badge) badge.textContent = String(total);
      } catch {}
    }

    function openCreateModal() {
      const form = document.getElementById('createForm');
      form.innerHTML = FIELDS.map(f => {
        const type = (f.field_type === 'integer' || f.field_type === 'float') ? 'number' : 'text';
        const step = f.field_type === 'float' ? 'step="0.01"' : '';
        return '<div class="form-field"><label>' + f.name + (f.required ? ' *' : '') + '</label>' +
          '<input class="input" name="' + f.name + '" type="' + type + '" ' + step + (f.required ? ' required' : '') + ' placeholder="Enter ' + f.name + '..." /></div>';
      }).join('') + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;"><button type="button" class="btn" onclick="closeCreateModal()">Cancel</button><button type="submit" class="btn btn-primary">Save ' + MODEL_NAME + '</button></div>';

      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = {};
        for (const f of FIELDS) {
          const val = fd.get(f.name);
          if (val !== null && val !== '') {
            payload[f.name] = (f.field_type === 'integer' || f.field_type === 'float') ? Number(val) : (f.field_type === 'boolean' ? val === 'true' : String(val));
          }
        }
        try {
          await apiFetch('/' + RESOURCE, { method: 'POST', body: JSON.stringify(payload) });
          closeCreateModal();
          showToast(MODEL_NAME + ' created via Live Mock API!');
          await renderView();
        } catch (err) {
          showToast('Error: ' + err.message);
        }
      };
      document.getElementById('createModal').classList.add('open');
    }

    function closeCreateModal() {
      document.getElementById('createModal').classList.remove('open');
    }

    async function addToCart(product) {
      try {
        await apiFetch('/cart', {
          method: 'POST',
          body: JSON.stringify({
            productId: product.id,
            title: product.title || product.name,
            unitPrice: Number(product.price || 0),
            quantity: 1,
          }),
        });
        await refreshCartCount();
        showToast('Added "' + (product.title || product.name) + '" to cart!');
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    async function advanceStatus(resource, id, nextStatus) {
      try {
        await apiFetch('/' + resource + '/' + encodeURIComponent(id), {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        showToast('Updated status to ' + nextStatus);
        await renderView();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    async function deleteRecord(resource, id) {
      try {
        await apiFetch('/' + resource + '/' + encodeURIComponent(id), { method: 'DELETE' });
        showToast('Removed record ' + id);
        await refreshCartCount();
        await renderView();
      } catch (err) {
        showToast('Error: ' + err.message);
      }
    }

    async function renderStorefront() {
      const heroActions = document.getElementById('heroActions');
      heroActions.innerHTML = '<button class="btn btn-primary" onclick="openCreateModal()">+ Add ' + MODEL_NAME + '</button>';
      const res = await apiFetch('/' + RESOURCE);
      const items = res.data || [];
      const categories = ['All', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))];
      let activeCat = 'All';
      let q = '';

      const body = document.getElementById('viewBody');
      body.innerHTML = '<div class="toolbar"><input id="sfSearch" class="input" style="flex:1;min-width:220px;" placeholder="Search ' + RESOURCE + '..." /><div id="catPills" style="display:flex;gap:6px;flex-wrap:wrap;"></div></div><div id="sfGrid" class="grid" style="margin-top:16px;"></div>';

      function paint() {
        document.getElementById('catPills').innerHTML = categories.map(c =>
          '<button class="nav-link ' + (c === activeCat ? 'active' : '') + '" onclick="window.__setCat(' + JSON.stringify(c) + ')">' + c + '</button>'
        ).join('');
        const filtered = items.filter(i => {
          const catOk = activeCat === 'All' || i.category === activeCat;
          const qOk = !q || JSON.stringify(i).toLowerCase().includes(q);
          return catOk && qOk;
        });
        document.getElementById('sfGrid').innerHTML = filtered.length === 0
          ? '<div class="card">No matching items found.</div>'
          : filtered.map(item => {
              const out = typeof item.stock === 'number' && item.stock <= 0;
              const low = typeof item.stock === 'number' && item.stock > 0 && item.stock <= 5;
              const badge = out ? '<span class="badge badge-bad">Out of Stock</span>' : low ? '<span class="badge badge-warn">Only ' + item.stock + ' left</span>' : '<span class="badge badge-ok">' + (item.category || item.status || 'Available') + '</span>';
              const priceHtml = item.price !== undefined ? '<div style="font-size:20px;font-weight:800;">$' + Number(item.price).toFixed(2) + '</div>' : '';
              const actionBtn = HAS_CART
                ? '<button class="btn btn-primary" ' + (out ? 'disabled' : '') + ' onclick=\'addToCart(' + JSON.stringify(item).replace(/'/g, '&#39;') + ')\'>' + (out ? 'Sold Out' : 'Add to Cart') + '</button>'
                : '<button class="btn btn-primary" onclick="akashaNavigate(\'/inquiries\')">Send Inquiry</button>';
              return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;">' + badge + (item.sku ? '<span style="font-size:11px;color:var(--muted);font-family:monospace;">' + item.sku + '</span>' : '') + '</div><div style="font-size:16px;font-weight:700;">' + (item.title || item.name || item.id) + '</div><p style="font-size:12.5px;color:var(--muted);line-height:1.45;flex:1;">' + (item.description || item.location || '') + '</p><div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">' + priceHtml + actionBtn + '</div></div>';
            }).join('');
      }
      window.__setCat = (c) => { activeCat = c; paint(); };
      document.getElementById('sfSearch').oninput = (e) => { q = e.target.value.toLowerCase(); paint(); };
      paint();
    }

    async function renderCheckout() {
      const [cartRes, couponRes] = await Promise.all([
        apiFetch('/cart').catch(() => ({ data: [] })),
        apiFetch('/coupons').catch(() => ({ data: [] })),
      ]);
      const cart = cartRes.data || [];
      const coupons = couponRes.data || [];
      let appliedCoupon = null;

      const body = document.getElementById('viewBody');
      function paint() {
        const subtotal = cart.reduce((s, c) => s + Number(c.unitPrice || 0) * Number(c.quantity || 1), 0);
        const discount = appliedCoupon ? subtotal * (Number(appliedCoupon.discountPercent || 0) / 100) : 0;
        const total = Math.max(0, subtotal - discount);

        body.innerHTML = '<div class="split">' +
          '<div class="card"><h2 style="font-size:16px;font-weight:700;">Shopping Cart (' + cart.length + ')</h2>' +
          (cart.length === 0
            ? '<p style="color:var(--muted);font-size:13px;">Your cart is empty. Head to Storefront to add products!</p><button class="btn btn-primary" style="width:fit-content;" onclick="akashaNavigate(\'/storefront\')">Browse Storefront</button>'
            : cart.map(c => '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);"><div><div style="font-weight:700;">' + c.title + '</div><div style="font-size:12px;color:var(--muted);">Qty ' + c.quantity + ' × $' + Number(c.unitPrice).toFixed(2) + '</div></div><div style="display:flex;align-items:center;gap:10px;"><strong>$' + (Number(c.unitPrice)*Number(c.quantity)).toFixed(2) + '</strong><button class="btn btn-danger" style="padding:5px 10px;" onclick="deleteRecord(\'cart\',\'' + c.id + '\')">Remove</button></div></div>').join('') +
            '<div style="display:flex;gap:8px;margin-top:8px;"><input id="couponInput" class="input" style="flex:1;" placeholder="Promo code (try WELCOME10)" value="' + (appliedCoupon ? appliedCoupon.code : '') + '" /><button class="btn" onclick="window.__applyCoupon()">Apply</button></div>' +
            '<div style="margin-top:10px;display:flex;justify-content:space-between;font-size:14px;"><span>Total</span><strong style="font-size:20px;color:#6ee7b7;">$' + total.toFixed(2) + '</strong></div>'
          ) + '</div>' +
          '<div class="card"><h2 style="font-size:16px;font-weight:700;">Shipping & Confirmation</h2>' +
          '<form id="checkoutForm">' +
            '<div class="form-field"><label>Customer Name *</label><input class="input" name="customerName" required placeholder="Layla Mansour" /></div>' +
            '<div class="form-field"><label>Email *</label><input class="input" name="customerEmail" type="email" required placeholder="layla@example.com" /></div>' +
            '<div class="form-field"><label>Shipping Address *</label><input class="input" name="shippingAddress" required placeholder="15 Maadi Rd, Cairo" /></div>' +
            '<button class="btn btn-primary" style="width:100%;" type="submit" ' + (cart.length === 0 ? 'disabled' : '') + '>Place Live Order ($' + total.toFixed(2) + ')</button>' +
          '</form></div></div>';

        window.__applyCoupon = () => {
          const code = (document.getElementById('couponInput').value || '').trim().toUpperCase();
          const found = coupons.find(c => String(c.code).toUpperCase() === code && c.active !== false);
          if (!found) { showToast('Invalid coupon code. Try WELCOME10 or LAUNCH20.'); return; }
          appliedCoupon = found;
          showToast('Applied ' + found.code + ' (-' + found.discountPercent + '%)');
          paint();
        };

        const form = document.getElementById('checkoutForm');
        if (form) {
          form.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(form);
            try {
              const created = await apiFetch('/orders', {
                method: 'POST',
                body: JSON.stringify({
                  customerName: fd.get('customerName'),
                  customerEmail: fd.get('customerEmail'),
                  shippingAddress: fd.get('shippingAddress'),
                  couponCode: appliedCoupon ? appliedCoupon.code : '',
                }),
              });
              await refreshCartCount();
              showToast('Order ' + created.data.id + ' placed! Redirecting to Orders...');
              setTimeout(() => akashaNavigate('/orders'), 700);
            } catch (err) {
              showToast('Checkout error: ' + err.message);
            }
          };
        }
      }
      paint();
    }

    async function renderBooking() {
      const res = await apiFetch('/services').catch(() => ({ data: [] }));
      const services = res.data || [];
      const body = document.getElementById('viewBody');
      body.innerHTML = '<div class="split"><div class="grid">' +
        services.map(s => '<div class="card"><span class="badge badge-ok">' + s.durationMins + ' mins</span><div style="font-size:16px;font-weight:700;">' + s.name + '</div><div style="font-size:12.5px;color:var(--muted);">Specialist: ' + s.providerName + '</div><div style="font-size:18px;font-weight:800;">$' + s.price + '</div><button class="btn btn-primary" onclick="window.__pickSrv(' + JSON.stringify(s.name) + ')">Select Service</button></div>').join('') +
        '</div><div class="card"><h2 style="font-size:16px;font-weight:700;">Confirm Reservation</h2><form id="bookForm">' +
        '<div class="form-field"><label>Selected Service *</label><input id="srvInput" class="input" name="serviceName" required value="' + (services[0] ? services[0].name : '') + '" /></div>' +
        '<div class="form-field"><label>Your Name *</label><input class="input" name="clientName" required placeholder="Hana Tarek" /></div>' +
        '<div class="form-field"><label>Email *</label><input class="input" name="clientEmail" type="email" required placeholder="hana@company.com" /></div>' +
        '<div class="form-field"><label>Preferred Slot *</label><select class="input" name="slotTime"><option>Tomorrow 10:00 AM</option><option>Tomorrow 1:00 PM</option><option>Thursday 3:30 PM</option></select></div>' +
        '<button class="btn btn-primary" style="width:100%;" type="submit">Confirm Live Booking</button></form></div></div>';

      window.__pickSrv = (name) => { document.getElementById('srvInput').value = name; showToast('Selected ' + name); };
      document.getElementById('bookForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await apiFetch('/bookings', {
            method: 'POST',
            body: JSON.stringify({
              serviceName: fd.get('serviceName'),
              clientName: fd.get('clientName'),
              clientEmail: fd.get('clientEmail'),
              slotTime: fd.get('slotTime'),
              status: 'confirmed',
            }),
          });
          showToast('Booking confirmed! Opening Schedule...');
          setTimeout(() => akashaNavigate('/bookings'), 700);
        } catch (err) {
          showToast('Error: ' + err.message);
        }
      };
    }

    async function renderLanding() {
      const body = document.getElementById('viewBody');
      body.innerHTML = '<div class="split"><div class="card" style="padding:28px;justify-content:center;"><span class="badge badge-ok">Early Access Open</span><h2 style="font-size:28px;font-weight:800;line-height:1.2;margin-top:6px;">Launch faster with ' + ${JSON.stringify(projectName)} + '</h2><p style="color:var(--muted);font-size:14px;line-height:1.6;">Join our early access cohort to get instant onboarding, team templates, and live workspace sync.</p></div>' +
        '<div class="card"><h3 style="font-size:16px;font-weight:700;">Join the Live Waitlist</h3><form id="leadForm">' +
        '<div class="form-field"><label>Full Name *</label><input class="input" name="name" required placeholder="Amira Said" /></div>' +
        '<div class="form-field"><label>Work Email *</label><input class="input" name="email" type="email" required placeholder="amira@team.io" /></div>' +
        '<div class="form-field"><label>Company</label><input class="input" name="company" placeholder="Studio Alpha" /></div>' +
        '<button class="btn btn-primary" style="width:100%;" type="submit">Join Waitlist</button></form></div></div>';

      document.getElementById('leadForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await apiFetch('/leads', {
            method: 'POST',
            body: JSON.stringify({ name: fd.get('name'), email: fd.get('email'), company: fd.get('company'), source: 'Landing Hero', status: 'new' }),
          });
          e.target.reset();
          showToast('You are on the waitlist! Saved to Leads CRM.');
        } catch (err) {
          showToast('Error: ' + err.message);
        }
      };
    }

    async function renderCrudOrDashboard() {
      const heroActions = document.getElementById('heroActions');
      heroActions.innerHTML = '<button class="btn btn-primary" onclick="openCreateModal()">+ New ' + MODEL_NAME + '</button>';
      const res = await apiFetch('/' + RESOURCE);
      const items = res.data || [];
      let q = '';

      const displayCols = FIELDS.slice(0, 5);
      const nextStatusMap = { pending: 'paid', paid: 'shipped', shipped: 'delivered', in_progress: 'done', active: 'archived', new: 'contacted', open: 'resolved', in_stock: 'deployed' };

      const body = document.getElementById('viewBody');
      const kpiHtml = PAGE_TYPE === 'dashboard'
        ? '<div class="kpi-grid"><div class="card"><div class="kpi-label">Total ' + MODEL_NAME + 's</div><div class="kpi-val">' + items.length + '</div></div><div class="card"><div class="kpi-label">Active / Confirmed</div><div class="kpi-val" style="color:#6ee7b7;">' + items.filter(i => ['active','paid','shipped','confirmed','deployed','verified','done'].includes(String(i.status).toLowerCase())).length + '</div></div><div class="card"><div class="kpi-label">Pending Attention</div><div class="kpi-val" style="color:#fcd34d;">' + items.filter(i => ['pending','new','open','in_progress'].includes(String(i.status).toLowerCase()) || (typeof i.stock === 'number' && i.stock <= 5)).length + '</div></div></div>'
        : '';

      body.innerHTML = kpiHtml + '<div class="panel"><div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;"><strong>' + MODEL_NAME + ' Live Records</strong><input id="tblSearch" class="input" placeholder="Filter records..." style="width:240px;" /></div><div style="overflow-x:auto;"><table><thead><tr>' +
        displayCols.map(c => '<th>' + c.name + '</th>').join('') + '<th>Actions</th></tr></thead><tbody id="tblBody"></tbody></table></div></div>';

      function paint() {
        const filtered = items.filter(i => !q || JSON.stringify(i).toLowerCase().includes(q));
        document.getElementById('tblBody').innerHTML = filtered.length === 0
          ? '<tr><td colspan="' + (displayCols.length + 1) + '" style="text-align:center;color:var(--muted);padding:24px;">No records yet. Click "+ New ' + MODEL_NAME + '" to create one live.</td></tr>'
          : filtered.map(item => {
              const curStatus = String(item.status || 'active').toLowerCase();
              const nextStatus = nextStatusMap[curStatus] || 'completed';
              return '<tr>' + displayCols.map(c => {
                const v = item[c.name];
                if (c.name === 'status') return '<td><span class="badge ' + (['active','paid','shipped','confirmed','done','verified'].includes(curStatus) ? 'badge-ok' : 'badge-warn') + '">' + String(v ?? '') + '</span></td>';
                if (c.name === 'price' || c.name === 'totalAmount' || c.name === 'amount') return '<td><strong>$' + Number(v || 0).toFixed(2) + '</strong></td>';
                return '<td>' + String(v ?? '—') + '</td>';
              }).join('') + '<td style="display:flex;gap:6px;"><button class="btn" style="padding:5px 10px;font-size:11.5px;" onclick="advanceStatus(' + JSON.stringify(RESOURCE) + ',' + JSON.stringify(item.id) + ',' + JSON.stringify(nextStatus) + ')">→ ' + nextStatus + '</button><button class="btn btn-danger" style="padding:5px 10px;font-size:11.5px;" onclick="deleteRecord(' + JSON.stringify(RESOURCE) + ',' + JSON.stringify(item.id) + ')">Del</button></td></tr>';
            }).join('');
      }
      document.getElementById('tblSearch').oninput = (e) => { q = e.target.value.toLowerCase(); paint(); };
      paint();
    }

    async function renderView() {
      await refreshCartCount();
      try {
        if (PAGE_TYPE === 'storefront') await renderStorefront();
        else if (PAGE_TYPE === 'checkout' && HAS_ORDERS) await renderCheckout();
        else if (PAGE_TYPE === 'booking') await renderBooking();
        else if (PAGE_TYPE === 'landing') await renderLanding();
        else await renderCrudOrDashboard();
      } catch (err) {
        document.getElementById('viewBody').innerHTML = '<div class="card" style="border-color:rgba(239,68,68,0.4);"><strong>Could not load live mock data:</strong> ' + err.message + '</div>';
      }
    }

    renderView();
  </script>
</body>
</html>`;
}

export async function compileProjectPrototype(projectId: string): Promise<CompiledPrototypeManifest> {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project ${projectId} not found`);

    const [rawPages, rawModels, rawComments] = await Promise.all([
        prisma.page.findMany({ where: { projectId } }).catch(() => []),
        prisma.dataModel.findMany({ where: { projectId } }).catch(() => []),
        prisma.projectComment.findMany({ where: { projectId, targetType: 'preview_pin' }, orderBy: { createdAt: 'desc' } }).catch(() => []),
    ]);

    const settings = safeJsonParse<Record<string, any>>(project.settings, {});
    const accentColor = settings.accentColor || '#6366f1';
    const activeModels = (rawModels || []).filter((m: any) => m.archived !== true);
    const activePages = (rawPages || []).filter((p: any) => p.archived !== true);

    const normalizedPages = activePages.length > 0
        ? activePages.map((p: any) => {
            const meta = safeJsonParse<Record<string, any>>(p.meta, {});
            return {
                id: p.id || p.idRoot,
                name: p.name || 'Overview',
                path: p.path || '/',
                pageType: String(meta.pageType || meta.type || (p.path === '/' ? 'dashboard' : 'list')),
                primaryEntity: meta.primaryEntity ? String(meta.primaryEntity) : undefined,
                description: String(meta.description || p.description || ''),
            };
        })
        : [{
            id: 'default-overview',
            name: `${project.name} Overview`,
            path: '/',
            pageType: 'dashboard',
            primaryEntity: activeModels[0]?.name,
            description: project.description || 'Interactive workspace preview connected to the live mock API.',
        }];

    const compiledPages: CompiledPrototypePage[] = normalizedPages.map((page) => {
        const primaryModel = activeModels.find((m: any) =>
            (page.primaryEntity && m.name.toLowerCase() === page.primaryEntity.toLowerCase()) ||
            page.name.toLowerCase().includes(m.name.toLowerCase())
        ) || activeModels[0];

        const html = renderInteractiveHtml({
            projectId,
            projectName: project.name,
            accentColor,
            page,
            allPages: normalizedPages,
            primaryModel,
            allModels: activeModels,
        });

        return { ...page, html };
    });

    return {
        projectId,
        projectName: project.name,
        projectDescription: project.description || '',
        archetype: settings.archetype,
        accentColor,
        mockApiBase: `/api/mock/${projectId}`,
        shareEnabled: settings.shareEnabled !== false,
        shareToken: settings.shareToken,
        pages: compiledPages,
        comments: (rawComments || []).map((c: any) => ({
            id: c.id,
            targetId: c.targetId,
            author: c.author,
            body: c.body,
            resolved: Boolean(c.resolved),
            pin: c.pin || null,
            createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
        })),
    };
}
