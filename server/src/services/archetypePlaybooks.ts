/**
 * Akasha V2 Product Archetype Playbooks
 *
 * Gives small teams (2-8 people) a real, production-informed starting architecture for common
 * real-world products: E-Commerce, Internal Tool, Booking/Service, SaaS, Marketplace, and Marketing Site.
 *
 * Each playbook defines:
 * - Domain entities with typed fields & relations
 * - REST API contracts
 * - Multi-page UI routes
 * - Vertical Feature Slices (MVP vs V1.1 vs Later) with acceptance criteria & domain edge cases teams forget
 * - Initial Architecture Decisions (ADRs)
 * - Realistic domain seed records for the Live Stateful Mock API (zero "John Doe" stubs)
 */

import prisma from '../lib/prisma.js';
import { safeJsonParse } from '../utils/safeJsonParse.js';
import { randomUUID } from 'node:crypto';

export type ArchetypeId =
    | 'ecommerce'
    | 'internal_tool'
    | 'booking_service'
    | 'saas_app'
    | 'marketplace'
    | 'marketing_site';

export interface PlaybookField {
    name: string;
    field_type: 'uuid' | 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'json';
    required: boolean;
    unique?: boolean;
    primary_key?: boolean;
}

export interface PlaybookModel {
    name: string;
    resource: string; // plural slug for mock API e.g. "products"
    description: string;
    fields: PlaybookField[];
    relations: Array<{ name: string; target_model: string; relation_type: string }>;
}

export interface PlaybookApi {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    name: string;
    description: string;
    entity: string;
}

export interface PlaybookPage {
    name: string;
    path: string;
    type: 'storefront' | 'dashboard' | 'list' | 'detail' | 'checkout' | 'booking' | 'landing' | 'settings';
    description: string;
    primaryEntity?: string;
}

export interface PlaybookSlice {
    key: string;
    title: string;
    summary: string;
    lane: 'mvp' | 'v1_1' | 'later';
    roleHint: string;
    models: string[];
    apis: string[]; // "METHOD /path"
    pages: string[];
    acceptanceCriteria: string[];
    edgeCases: string[];
}

export interface ProductPlaybook {
    id: ArchetypeId;
    name: string;
    tagline: string;
    category: string;
    accentColor: string;
    recommendedRoles: string[];
    models: PlaybookModel[];
    apis: PlaybookApi[];
    pages: PlaybookPage[];
    slices: PlaybookSlice[];
    decisions: Array<{ title: string; context: string; decision: string }>;
    seedData: Record<string, Array<Record<string, unknown>>>;
}

export const PRODUCT_PLAYBOOKS: Record<ArchetypeId, ProductPlaybook> = {
    ecommerce: {
        id: 'ecommerce',
        name: 'E-Commerce Storefront',
        tagline: 'Catalog, live shopping cart, coupon codes, checkout, and order & inventory admin.',
        category: 'Commerce',
        accentColor: '#10b981',
        recommendedRoles: ['Founder / PM', 'Designer', 'Frontend Engineer', 'Backend Engineer'],
        models: [
            {
                name: 'Product',
                resource: 'products',
                description: 'Sellable catalog item with pricing, inventory stock, category, and SKU.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'title', field_type: 'string', required: true },
                    { name: 'sku', field_type: 'string', required: true, unique: true },
                    { name: 'category', field_type: 'string', required: true },
                    { name: 'price', field_type: 'float', required: true },
                    { name: 'stock', field_type: 'integer', required: true },
                    { name: 'status', field_type: 'string', required: true },
                    { name: 'description', field_type: 'string', required: false },
                ],
                relations: [],
            },
            {
                name: 'CartItem',
                resource: 'cart',
                description: 'Active shopping cart line item linked to a product.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'productId', field_type: 'uuid', required: true },
                    { name: 'title', field_type: 'string', required: true },
                    { name: 'unitPrice', field_type: 'float', required: true },
                    { name: 'quantity', field_type: 'integer', required: true },
                ],
                relations: [{ name: 'product', target_model: 'Product', relation_type: 'many_to_one' }],
            },
            {
                name: 'Order',
                resource: 'orders',
                description: 'Customer order record with payment status, shipping address, coupon, and line items.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'customerName', field_type: 'string', required: true },
                    { name: 'customerEmail', field_type: 'string', required: true },
                    { name: 'shippingAddress', field_type: 'string', required: true },
                    { name: 'couponCode', field_type: 'string', required: false },
                    { name: 'totalAmount', field_type: 'float', required: true },
                    { name: 'status', field_type: 'string', required: true },
                    { name: 'items', field_type: 'json', required: false },
                ],
                relations: [],
            },
            {
                name: 'Coupon',
                resource: 'coupons',
                description: 'Promotional discount rule applied at checkout.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'code', field_type: 'string', required: true, unique: true },
                    { name: 'discountPercent', field_type: 'integer', required: true },
                    { name: 'active', field_type: 'boolean', required: true },
                ],
                relations: [],
            },
        ],
        apis: [
            { method: 'GET', path: '/api/v1/products', name: 'List Products', description: 'Browse & filter storefront catalog', entity: 'Product' },
            { method: 'POST', path: '/api/v1/products', name: 'Create Product', description: 'Add a new SKU to inventory', entity: 'Product' },
            { method: 'PATCH', path: '/api/v1/products/:id', name: 'Update Product', description: 'Update stock level, price, or status', entity: 'Product' },
            { method: 'GET', path: '/api/v1/cart', name: 'Get Cart Items', description: 'Fetch active cart items', entity: 'CartItem' },
            { method: 'POST', path: '/api/v1/cart', name: 'Add to Cart', description: 'Add or increment a product in the cart', entity: 'CartItem' },
            { method: 'DELETE', path: '/api/v1/cart/:id', name: 'Remove Cart Item', description: 'Remove an item from the cart', entity: 'CartItem' },
            { method: 'GET', path: '/api/v1/orders', name: 'List Orders', description: 'Fetch customer and admin order list', entity: 'Order' },
            { method: 'POST', path: '/api/v1/orders', name: 'Place Order', description: 'Validate stock, apply coupon, create order, clear cart', entity: 'Order' },
            { method: 'PATCH', path: '/api/v1/orders/:id', name: 'Update Order Status', description: 'Advance fulfillment status (paid/shipped/refunded)', entity: 'Order' },
            { method: 'GET', path: '/api/v1/coupons', name: 'List Coupons', description: 'Validate or manage promotional codes', entity: 'Coupon' },
        ],
        pages: [
            { name: 'Storefront', path: '/storefront', type: 'storefront', description: 'Customer catalog with category filters, live stock badges, and 1-click Add to Cart.', primaryEntity: 'Product' },
            { name: 'Cart & Checkout', path: '/checkout', type: 'checkout', description: 'Live cart summary, coupon code validation, shipping form, and instant order placement.', primaryEntity: 'Order' },
            { name: 'Orders Tracker', path: '/orders', type: 'list', description: 'Live order list with fulfillment status filters and quick status updates.', primaryEntity: 'Order' },
            { name: 'Inventory Admin', path: '/admin/inventory', type: 'dashboard', description: 'Team admin dashboard to add new SKUs, monitor low stock, and review store revenue.', primaryEntity: 'Product' },
        ],
        slices: [
            {
                key: 'catalog',
                title: 'Storefront Catalog & Search',
                summary: 'Shoppers browse products by category, search by keyword, inspect stock availability, and add items to cart.',
                lane: 'mvp',
                roleHint: 'Frontend Engineer',
                models: ['Product'],
                apis: ['GET /api/v1/products'],
                pages: ['Storefront'],
                acceptanceCriteria: [
                    'Products display title, price, category, and live stock status badge',
                    'Real-time search and category pills filter visible products instantly',
                    'Out-of-stock products disable Add to Cart with a clear badge',
                ],
                edgeCases: [
                    'Handle empty search results with a quick "Clear filters" action',
                    'Prevent adding quantity greater than available product stock',
                ],
            },
            {
                key: 'checkout',
                title: 'Shopping Cart, Coupons & Checkout',
                summary: 'Customers review cart line items, apply promo coupons, enter shipping info, and submit an order.',
                lane: 'mvp',
                roleHint: 'Fullstack Engineer',
                models: ['CartItem', 'Order', 'Coupon', 'Product'],
                apis: ['GET /api/v1/cart', 'POST /api/v1/cart', 'DELETE /api/v1/cart/:id', 'POST /api/v1/orders', 'GET /api/v1/coupons'],
                pages: ['Cart & Checkout'],
                acceptanceCriteria: [
                    'Cart total recalculates automatically on quantity change or item removal',
                    'Valid coupon codes apply percentage discount before order submission',
                    'Placing an order creates a persisted Order record and empties the cart',
                ],
                edgeCases: [
                    'Reject expired or inactive coupon codes with clear error feedback',
                    'Prevent checkout when cart is empty or required shipping fields are missing',
                    'Decrement product stock atomically upon order placement',
                ],
            },
            {
                key: 'inventory-admin',
                title: 'Inventory & Fulfillment Admin',
                summary: 'Small-team operators add new products, adjust inventory counts, and advance order fulfillment states.',
                lane: 'mvp',
                roleHint: 'Backend Engineer',
                models: ['Product', 'Order'],
                apis: ['POST /api/v1/products', 'PATCH /api/v1/products/:id', 'GET /api/v1/orders', 'PATCH /api/v1/orders/:id'],
                pages: ['Inventory Admin', 'Orders Tracker'],
                acceptanceCriteria: [
                    'Operators can create a new product SKU and immediately see it in Storefront',
                    'Orders transition cleanly from Pending -> Paid -> Shipped -> Delivered',
                ],
                edgeCases: [
                    'Highlight low-stock items (stock <= 5) in the admin dashboard',
                    'Support refund/cancellation state without deleting order history',
                ],
            },
            {
                key: 'customer-accounts',
                title: 'Saved Addresses & Order Notifications',
                summary: 'Returning buyers sign in to view order history and receive automated shipping updates.',
                lane: 'v1_1',
                roleHint: 'Backend Engineer',
                models: ['Order'],
                apis: ['GET /api/v1/orders'],
                pages: ['Orders Tracker'],
                acceptanceCriteria: [
                    'Guest checkout remains frictionless without forcing account creation',
                    'Order confirmation displays a shareable tracking ID',
                ],
                edgeCases: [
                    'Prevent exposing another customer\'s order via sequential IDs',
                ],
            },
        ],
        decisions: [
            {
                title: 'Guest Checkout First for MVP',
                context: 'Forcing account registration reduces conversion by 25-35% on new e-commerce launches.',
                decision: 'Ship guest checkout with email receipt in MVP; defer customer login accounts to V1.1.',
            },
            {
                title: 'Single-Currency Decimal Pricing',
                context: 'Floating-point rounding bugs cause payment gateway mismatches.',
                decision: 'Store prices in clean numeric units and calculate totals server-side before order confirmation.',
            },
        ],
        seedData: {
            products: [
                { id: 'prod-101', title: 'AeroRun Knit Sneaker', sku: 'SNK-AR-01', category: 'Footwear', price: 129.0, stock: 18, status: 'active', description: 'Lightweight breathable everyday runner with responsive foam midsole.' },
                { id: 'prod-102', title: 'Nomad Everyday Sling 6L', sku: 'BAG-NM-06', category: 'Accessories', price: 74.5, stock: 9, status: 'active', description: 'Weather-resistant crossbody sling with magnetic buckle and tablet sleeve.' },
                { id: 'prod-103', title: 'Merino Travel Hoodie', sku: 'APP-MR-12', category: 'Apparel', price: 148.0, stock: 4, status: 'active', description: 'Temperature-regulating merino wool blend built for long flights.' },
                { id: 'prod-104', title: 'Titanium Insulated Flask', sku: 'ACC-TI-24', category: 'Accessories', price: 52.0, stock: 0, status: 'out_of_stock', description: '24oz vacuum-sealed matte flask keeping drinks cold for 24 hours.' },
            ],
            cart: [
                { id: 'cart-1', productId: 'prod-101', title: 'AeroRun Knit Sneaker', unitPrice: 129.0, quantity: 1 },
            ],
            orders: [
                { id: 'ord-9001', customerName: 'Nadia Mansour', customerEmail: 'nadia@example.com', shippingAddress: '42 Nile Corniche, Cairo', couponCode: 'WELCOME10', totalAmount: 183.15, status: 'shipped', items: [{ title: 'AeroRun Knit Sneaker', qty: 1 }, { title: 'Nomad Everyday Sling 6L', qty: 1 }] },
                { id: 'ord-9002', customerName: 'Omar Farouk', customerEmail: 'omar@example.com', shippingAddress: '18 Zamalek St, Giza', couponCode: '', totalAmount: 148.0, status: 'paid', items: [{ title: 'Merino Travel Hoodie', qty: 1 }] },
            ],
            coupons: [
                { id: 'cpn-1', code: 'WELCOME10', discountPercent: 10, active: true },
                { id: 'cpn-2', code: 'LAUNCH20', discountPercent: 20, active: true },
            ],
        },
    },

    internal_tool: {
        id: 'internal_tool',
        name: 'Internal Operations Tool',
        tagline: 'Inventory/asset tracker, approval queues, role permissions, and full audit trail.',
        category: 'Operations',
        accentColor: '#3b82f6',
        recommendedRoles: ['Ops Lead', 'Frontend Engineer', 'Backend Engineer'],
        models: [
            {
                name: 'Asset',
                resource: 'assets',
                description: 'Tracked operational asset, equipment, or inventory unit.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'name', field_type: 'string', required: true },
                    { name: 'tagCode', field_type: 'string', required: true, unique: true },
                    { name: 'department', field_type: 'string', required: true },
                    { name: 'assignee', field_type: 'string', required: false },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
            {
                name: 'ApprovalRequest',
                resource: 'approvals',
                description: 'Procurement or access approval workflow item.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'title', field_type: 'string', required: true },
                    { name: 'requester', field_type: 'string', required: true },
                    { name: 'amount', field_type: 'float', required: false },
                    { name: 'priority', field_type: 'string', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
            {
                name: 'AuditLog',
                resource: 'audit-logs',
                description: 'Immutable operator activity log for compliance.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'actor', field_type: 'string', required: true },
                    { name: 'action', field_type: 'string', required: true },
                    { name: 'target', field_type: 'string', required: true },
                    { name: 'timestamp', field_type: 'datetime', required: true },
                ],
                relations: [],
            },
        ],
        apis: [
            { method: 'GET', path: '/api/v1/assets', name: 'List Assets', description: 'Filterable internal asset registry', entity: 'Asset' },
            { method: 'POST', path: '/api/v1/assets', name: 'Register Asset', description: 'Add new operational asset', entity: 'Asset' },
            { method: 'PATCH', path: '/api/v1/assets/:id', name: 'Update Asset', description: 'Reassign or update asset status', entity: 'Asset' },
            { method: 'GET', path: '/api/v1/approvals', name: 'List Approvals', description: 'Fetch pending approval requests', entity: 'ApprovalRequest' },
            { method: 'POST', path: '/api/v1/approvals', name: 'Submit Request', description: 'Create new approval ticket', entity: 'ApprovalRequest' },
            { method: 'PATCH', path: '/api/v1/approvals/:id', name: 'Resolve Approval', description: 'Approve or reject request', entity: 'ApprovalRequest' },
            { method: 'GET', path: '/api/v1/audit-logs', name: 'List Audit Logs', description: 'Read immutable compliance log', entity: 'AuditLog' },
        ],
        pages: [
            { name: 'Ops Overview', path: '/dashboard', type: 'dashboard', description: 'Operational KPIs, pending approvals, and live audit stream.', primaryEntity: 'Asset' },
            { name: 'Asset Registry', path: '/assets', type: 'list', description: 'Searchable asset table with quick creation and status controls.', primaryEntity: 'Asset' },
            { name: 'Approval Queue', path: '/approvals', type: 'list', description: 'One-click approve/reject workflow queue with priority filters.', primaryEntity: 'ApprovalRequest' },
        ],
        slices: [
            {
                key: 'asset-registry',
                title: 'Searchable Asset & Inventory Registry',
                summary: 'Operators search, filter, register, and reassign company assets with instant updates.',
                lane: 'mvp',
                roleHint: 'Fullstack Engineer',
                models: ['Asset'],
                apis: ['GET /api/v1/assets', 'POST /api/v1/assets', 'PATCH /api/v1/assets/:id'],
                pages: ['Asset Registry', 'Ops Overview'],
                acceptanceCriteria: [
                    'Table supports instant search by name, tag code, or department',
                    'Operators can register new assets and toggle maintenance/deployed statuses',
                ],
                edgeCases: [
                    'Enforce unique tag codes to prevent duplicate inventory entries',
                    'Support CSV export for finance and operations audits',
                ],
            },
            {
                key: 'approval-queue',
                title: 'Approval Workflow & Audit Trail',
                summary: 'Managers review purchase/access requests and every state change writes an audit entry.',
                lane: 'mvp',
                roleHint: 'Backend Engineer',
                models: ['ApprovalRequest', 'AuditLog'],
                apis: ['GET /api/v1/approvals', 'POST /api/v1/approvals', 'PATCH /api/v1/approvals/:id', 'GET /api/v1/audit-logs'],
                pages: ['Approval Queue', 'Ops Overview'],
                acceptanceCriteria: [
                    'Pending requests display requester, cost, priority, and 1-click Approve/Reject buttons',
                    'Status changes persist and update dashboard pending counters',
                ],
                edgeCases: [
                    'Prevent self-approval by the original requester',
                    'Audit log entries must be append-only (no delete endpoint)',
                ],
            },
        ],
        decisions: [
            {
                title: 'Append-Only Audit Log',
                context: 'Internal ops tools fail compliance reviews when state changes cannot be traced.',
                decision: 'Log all asset and approval mutations to AuditLog without exposing delete routes.',
            },
        ],
        seedData: {
            assets: [
                { id: 'ast-1', name: 'MacBook Pro 16" M4', tagCode: 'ENG-MBP-042', department: 'Engineering', assignee: 'Sara Khaled', status: 'deployed' },
                { id: 'ast-2', name: 'Zebra Barcode Scanner', tagCode: 'OPS-SCN-019', department: 'Warehouse', assignee: 'Karim Adel', status: 'deployed' },
                { id: 'ast-3', name: 'Dell UltraSharp 32" 4K', tagCode: 'DES-MON-011', department: 'Design', assignee: 'Unassigned', status: 'in_stock' },
            ],
            approvals: [
                { id: 'apr-1', title: 'Cloudflare Pro Annual Upgrade', requester: 'Tarek H.', amount: 240, priority: 'high', status: 'pending' },
                { id: 'apr-2', title: '2x Warehouse Label Printers', requester: 'Karim Adel', amount: 580, priority: 'medium', status: 'pending' },
            ],
            'audit-logs': [
                { id: 'aud-1', actor: 'Sara Khaled', action: 'ASSET_ASSIGNED', target: 'ENG-MBP-042', timestamp: new Date().toISOString() },
            ],
        },
    },

    booking_service: {
        id: 'booking_service',
        name: 'Booking & Service Portal',
        tagline: 'Service catalog, live time-slot scheduling, client bookings, and staff calendar.',
        category: 'Services',
        accentColor: '#8b5cf6',
        recommendedRoles: ['Founder', 'Designer', 'Fullstack Engineer'],
        models: [
            {
                name: 'Service',
                resource: 'services',
                description: 'Bookable service offering with duration and price.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'name', field_type: 'string', required: true },
                    { name: 'durationMins', field_type: 'integer', required: true },
                    { name: 'price', field_type: 'float', required: true },
                    { name: 'providerName', field_type: 'string', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
            {
                name: 'Booking',
                resource: 'bookings',
                description: 'Confirmed or pending customer appointment.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'serviceName', field_type: 'string', required: true },
                    { name: 'clientName', field_type: 'string', required: true },
                    { name: 'clientEmail', field_type: 'string', required: true },
                    { name: 'slotTime', field_type: 'string', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [{ name: 'service', target_model: 'Service', relation_type: 'many_to_one' }],
            },
        ],
        apis: [
            { method: 'GET', path: '/api/v1/services', name: 'List Services', description: 'Browse available bookable services', entity: 'Service' },
            { method: 'POST', path: '/api/v1/services', name: 'Create Service', description: 'Add a new service offering', entity: 'Service' },
            { method: 'GET', path: '/api/v1/bookings', name: 'List Bookings', description: 'View upcoming bookings', entity: 'Booking' },
            { method: 'POST', path: '/api/v1/bookings', name: 'Create Booking', description: 'Reserve an available time slot', entity: 'Booking' },
            { method: 'PATCH', path: '/api/v1/bookings/:id', name: 'Update Booking', description: 'Confirm, reschedule, or cancel booking', entity: 'Booking' },
        ],
        pages: [
            { name: 'Book a Session', path: '/book', type: 'booking', description: 'Customer-facing service picker and instant slot reservation.', primaryEntity: 'Service' },
            { name: 'Schedule & Bookings', path: '/bookings', type: 'list', description: 'Staff booking tracker with confirm/cancel quick actions.', primaryEntity: 'Booking' },
            { name: 'Studio Dashboard', path: '/dashboard', type: 'dashboard', description: 'Daily utilization metrics and service catalog management.', primaryEntity: 'Booking' },
        ],
        slices: [
            {
                key: 'slot-booking',
                title: 'Customer Service Selection & Booking',
                summary: 'Clients choose a service, pick a time slot, and confirm their booking in under 60 seconds.',
                lane: 'mvp',
                roleHint: 'Frontend Engineer',
                models: ['Service', 'Booking'],
                apis: ['GET /api/v1/services', 'POST /api/v1/bookings'],
                pages: ['Book a Session'],
                acceptanceCriteria: [
                    'Clients see service duration, specialist name, and price upfront',
                    'Submitting a booking immediately creates a confirmed record in Schedule & Bookings',
                ],
                edgeCases: [
                    'Block double-booking the exact same provider & slotTime',
                    'Handle timezone display cleanly and enforce 24h cancellation notice',
                ],
            },
            {
                key: 'staff-schedule',
                title: 'Staff Schedule & Cancellation Management',
                summary: 'Team members view daily bookings, mark arrivals, and manage reschedules.',
                lane: 'mvp',
                roleHint: 'Backend Engineer',
                models: ['Booking'],
                apis: ['GET /api/v1/bookings', 'PATCH /api/v1/bookings/:id'],
                pages: ['Schedule & Bookings', 'Studio Dashboard'],
                acceptanceCriteria: [
                    'Staff can confirm, complete, or cancel bookings with 1 click',
                ],
                edgeCases: [
                    'Cancelled bookings free up the slot for new clients automatically',
                ],
            },
        ],
        decisions: [
            {
                title: 'Zero-Login Instant Booking for Clients',
                context: 'Service businesses lose 40%+ bookings when clients must register a password first.',
                decision: 'Collect client name + email per booking and issue a confirmation reference code.',
            },
        ],
        seedData: {
            services: [
                { id: 'srv-1', name: 'Brand Strategy Sprint (60m)', durationMins: 60, price: 120, providerName: 'Laila Hassan', status: 'active' },
                { id: 'srv-2', name: 'UX Audit & Wireframe Review', durationMins: 45, price: 95, providerName: 'Youssef Nabil', status: 'active' },
                { id: 'srv-3', name: 'Technical Architecture Clinic', durationMins: 90, price: 180, providerName: 'Ahmed Sami', status: 'active' },
            ],
            bookings: [
                { id: 'bk-101', serviceName: 'Brand Strategy Sprint (60m)', clientName: 'Mona El-Sayed', clientEmail: 'mona@studio.io', slotTime: 'Tomorrow 10:00 AM', status: 'confirmed' },
                { id: 'bk-102', serviceName: 'UX Audit & Wireframe Review', clientName: 'David Chen', clientEmail: 'david@acme.co', slotTime: 'Tomorrow 2:30 PM', status: 'pending' },
            ],
        },
    },

    saas_app: {
        id: 'saas_app',
        name: 'SaaS Web Application',
        tagline: 'Multi-tenant workspaces, project tracking, member invites, and plan billing.',
        category: 'SaaS',
        accentColor: '#6366f1',
        recommendedRoles: ['Founder', 'Product Designer', 'Frontend Engineer', 'Backend Engineer'],
        models: [
            {
                name: 'Workspace',
                resource: 'workspaces',
                description: 'Tenant organization with subscription plan and usage limits.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'name', field_type: 'string', required: true },
                    { name: 'plan', field_type: 'string', required: true },
                    { name: 'seatsUsed', field_type: 'integer', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
            {
                name: 'CustomerItem',
                resource: 'items',
                description: 'Core workspace deliverable or tracked workflow item.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'title', field_type: 'string', required: true },
                    { name: 'owner', field_type: 'string', required: true },
                    { name: 'priority', field_type: 'string', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
        ],
        apis: [
            { method: 'GET', path: '/api/v1/workspaces', name: 'List Workspaces', description: 'Get tenant workspaces', entity: 'Workspace' },
            { method: 'POST', path: '/api/v1/workspaces', name: 'Create Workspace', description: 'Provision a new workspace', entity: 'Workspace' },
            { method: 'GET', path: '/api/v1/items', name: 'List Items', description: 'List core workspace items', entity: 'CustomerItem' },
            { method: 'POST', path: '/api/v1/items', name: 'Create Item', description: 'Add a new workspace item', entity: 'CustomerItem' },
            { method: 'PATCH', path: '/api/v1/items/:id', name: 'Update Item', description: 'Update status or owner', entity: 'CustomerItem' },
        ],
        pages: [
            { name: 'Workspace Dashboard', path: '/dashboard', type: 'dashboard', description: 'Usage KPIs, active items, and plan status.', primaryEntity: 'CustomerItem' },
            { name: 'Items Manager', path: '/items', type: 'list', description: 'Filterable CRUD workspace for core items.', primaryEntity: 'CustomerItem' },
            { name: 'Billing & Team', path: '/settings', type: 'settings', description: 'Plan upgrades, seat management, and API keys.', primaryEntity: 'Workspace' },
        ],
        slices: [
            {
                key: 'core-workflow',
                title: 'Core Workspace CRUD & Dashboard',
                summary: 'Users sign into their workspace, create and track core items, and monitor live KPIs.',
                lane: 'mvp',
                roleHint: 'Fullstack Engineer',
                models: ['Workspace', 'CustomerItem'],
                apis: ['GET /api/v1/items', 'POST /api/v1/items', 'PATCH /api/v1/items/:id'],
                pages: ['Workspace Dashboard', 'Items Manager'],
                acceptanceCriteria: [
                    'Dashboard reflects real-time counts of open and completed items',
                    'Users can create, search, and update item statuses seamlessly',
                ],
                edgeCases: [
                    'Isolate records strictly by workspaceId (tenant boundary)',
                    'Enforce plan seat & item quota gracefully with an upgrade prompt',
                ],
            },
            {
                key: 'team-billing',
                title: 'Team Invites & Plan Limits',
                summary: 'Workspace admins invite teammates, assign roles, and manage subscription tiers.',
                lane: 'v1_1',
                roleHint: 'Backend Engineer',
                models: ['Workspace'],
                apis: ['GET /api/v1/workspaces', 'POST /api/v1/workspaces'],
                pages: ['Billing & Team'],
                acceptanceCriteria: [
                    'Admins can switch plans and inspect current seat utilization',
                ],
                edgeCases: [
                    'Handle webhook idempotency for subscription renewals and failed charges',
                ],
            },
        ],
        decisions: [
            {
                title: 'Workspace-Scoped Multi-Tenancy from Day 1',
                context: 'Retrofitting team workspaces onto single-user tables causes major migrations later.',
                decision: 'Include workspaceId on all core tenant entities from the MVP schema.',
            },
        ],
        seedData: {
            workspaces: [
                { id: 'ws-1', name: 'Northstar Studio', plan: 'Pro', seatsUsed: 4, status: 'active' },
            ],
            items: [
                { id: 'itm-1', title: 'Q4 Launch Onboarding Flow', owner: 'Rami T.', priority: 'high', status: 'in_progress' },
                { id: 'itm-2', title: 'Webhook Retry Monitor', owner: 'Dina M.', priority: 'medium', status: 'done' },
            ],
        },
    },

    marketplace: {
        id: 'marketplace',
        name: 'Two-Sided Marketplace',
        tagline: 'Verified listings, seller publishing, buyer inquiries, and moderation queue.',
        category: 'Marketplace',
        accentColor: '#f59e0b',
        recommendedRoles: ['Founder', 'Designer', 'Frontend Engineer', 'Backend Engineer'],
        models: [
            {
                name: 'Listing',
                resource: 'listings',
                description: 'Marketplace listing published by a seller.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'title', field_type: 'string', required: true },
                    { name: 'category', field_type: 'string', required: true },
                    { name: 'price', field_type: 'float', required: true },
                    { name: 'sellerName', field_type: 'string', required: true },
                    { name: 'location', field_type: 'string', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
            {
                name: 'Inquiry',
                resource: 'inquiries',
                description: 'Buyer message or offer tied to a listing.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'listingTitle', field_type: 'string', required: true },
                    { name: 'buyerName', field_type: 'string', required: true },
                    { name: 'message', field_type: 'string', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [{ name: 'listing', target_model: 'Listing', relation_type: 'many_to_one' }],
            },
        ],
        apis: [
            { method: 'GET', path: '/api/v1/listings', name: 'Browse Listings', description: 'Search & filter active marketplace listings', entity: 'Listing' },
            { method: 'POST', path: '/api/v1/listings', name: 'Publish Listing', description: 'Seller publishes a new listing', entity: 'Listing' },
            { method: 'PATCH', path: '/api/v1/listings/:id', name: 'Moderate Listing', description: 'Approve, feature, or archive listing', entity: 'Listing' },
            { method: 'GET', path: '/api/v1/inquiries', name: 'List Inquiries', description: 'Seller inbox of buyer messages', entity: 'Inquiry' },
            { method: 'POST', path: '/api/v1/inquiries', name: 'Send Inquiry', description: 'Buyer contacts seller on a listing', entity: 'Inquiry' },
        ],
        pages: [
            { name: 'Explore Listings', path: '/explore', type: 'storefront', description: 'Searchable marketplace directory with category filters and seller cards.', primaryEntity: 'Listing' },
            { name: 'Buyer Inquiries', path: '/inquiries', type: 'list', description: 'Active buyer/seller conversations and offer states.', primaryEntity: 'Inquiry' },
            { name: 'Moderation Hub', path: '/dashboard', type: 'dashboard', description: 'Approve new listings and track marketplace liquidity.', primaryEntity: 'Listing' },
        ],
        slices: [
            {
                key: 'listing-discovery',
                title: 'Listing Discovery & Seller Publishing',
                summary: 'Buyers browse verified listings by category/location while sellers publish new items.',
                lane: 'mvp',
                roleHint: 'Frontend Engineer',
                models: ['Listing'],
                apis: ['GET /api/v1/listings', 'POST /api/v1/listings'],
                pages: ['Explore Listings'],
                acceptanceCriteria: [
                    'Sellers can publish a listing and see it immediately appear in the marketplace',
                    'Buyers can filter listings by category or search keyword',
                ],
                edgeCases: [
                    'Route new seller listings through pending moderation or trust flags to prevent spam',
                ],
            },
            {
                key: 'buyer-inquiries',
                title: 'Buyer-Seller Inquiry Loop',
                summary: 'Buyers submit questions/offers on a listing and sellers track replies.',
                lane: 'mvp',
                roleHint: 'Backend Engineer',
                models: ['Inquiry'],
                apis: ['GET /api/v1/inquiries', 'POST /api/v1/inquiries'],
                pages: ['Buyer Inquiries', 'Moderation Hub'],
                acceptanceCriteria: [
                    'Inquiries persist with listing context and reply status',
                ],
                edgeCases: [
                    'Rate-limit inquiry spam and mask personal phone numbers until accepted',
                ],
            },
        ],
        decisions: [
            {
                title: 'Inquiry-First Liquidity Before Escrow',
                context: 'Building escrow payouts before proving buyer-seller demand slows launch by months.',
                decision: 'Ship direct buyer inquiries in MVP; add Stripe Connect payouts in V1.1.',
            },
        ],
        seedData: {
            listings: [
                { id: 'lst-1', title: 'Sony FX3 Cinema Camera Kit', category: 'Video Gear', price: 95, sellerName: 'Hossam Media', location: 'Cairo', status: 'verified' },
                { id: 'lst-2', title: 'Boutique Podcast Studio (Hourly)', category: 'Spaces', price: 45, sellerName: 'SoundLab Maadi', location: 'Maadi', status: 'verified' },
            ],
            inquiries: [
                { id: 'inq-1', listingTitle: 'Sony FX3 Cinema Camera Kit', buyerName: 'Salma R.', message: 'Available for a 2-day commercial shoot next Thursday?', status: 'open' },
            ],
        },
    },

    marketing_site: {
        id: 'marketing_site',
        name: 'Launch Site & Waitlist CMS',
        tagline: 'Conversion landing page, live waitlist lead capture, blog/changelog, and lead CRM.',
        category: 'Web & Growth',
        accentColor: '#06b6d4',
        recommendedRoles: ['Founder / Marketer', 'Designer', 'Frontend Engineer'],
        models: [
            {
                name: 'Lead',
                resource: 'leads',
                description: 'Waitlist signup or inbound demo request.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'name', field_type: 'string', required: true },
                    { name: 'email', field_type: 'string', required: true, unique: true },
                    { name: 'company', field_type: 'string', required: false },
                    { name: 'source', field_type: 'string', required: false },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
            {
                name: 'Post',
                resource: 'posts',
                description: 'Published launch update, blog post, or case study.',
                fields: [
                    { name: 'id', field_type: 'uuid', required: true, unique: true, primary_key: true },
                    { name: 'title', field_type: 'string', required: true },
                    { name: 'category', field_type: 'string', required: true },
                    { name: 'summary', field_type: 'string', required: true },
                    { name: 'status', field_type: 'string', required: true },
                ],
                relations: [],
            },
        ],
        apis: [
            { method: 'GET', path: '/api/v1/leads', name: 'List Leads', description: 'View captured waitlist & demo leads', entity: 'Lead' },
            { method: 'POST', path: '/api/v1/leads', name: 'Capture Lead', description: 'Submit waitlist signup form', entity: 'Lead' },
            { method: 'GET', path: '/api/v1/posts', name: 'List Posts', description: 'Fetch published blog/changelog entries', entity: 'Post' },
            { method: 'POST', path: '/api/v1/posts', name: 'Publish Post', description: 'Create a new article or update', entity: 'Post' },
        ],
        pages: [
            { name: 'Landing Page', path: '/', type: 'landing', description: 'Hero value prop, social proof, feature highlights, and live waitlist form.', primaryEntity: 'Lead' },
            { name: 'Changelog & Blog', path: '/blog', type: 'list', description: 'Published updates and customer stories.', primaryEntity: 'Post' },
            { name: 'Leads CRM', path: '/admin/leads', type: 'dashboard', description: 'Track incoming signups, conversion sources, and follow-up status.', primaryEntity: 'Lead' },
        ],
        slices: [
            {
                key: 'landing-waitlist',
                title: 'Hero Landing Page & Live Waitlist',
                summary: 'Visitors understand the product in 5 seconds and join the waitlist directly into the Leads CRM.',
                lane: 'mvp',
                roleHint: 'Designer',
                models: ['Lead'],
                apis: ['POST /api/v1/leads', 'GET /api/v1/leads'],
                pages: ['Landing Page', 'Leads CRM'],
                acceptanceCriteria: [
                    'Waitlist form validates email and shows instant confirmation state',
                    'New signups immediately appear in Leads CRM with timestamp and source',
                ],
                edgeCases: [
                    'Deduplicate repeated email signups gracefully without throwing 500 errors',
                    'Ensure OpenGraph meta tags and mobile viewport layout look crisp',
                ],
            },
            {
                key: 'content-cms',
                title: 'Lightweight Changelog & Blog CMS',
                summary: 'Team publishes product updates and case studies without redeploying code.',
                lane: 'v1_1',
                roleHint: 'Frontend Engineer',
                models: ['Post'],
                apis: ['GET /api/v1/posts', 'POST /api/v1/posts'],
                pages: ['Changelog & Blog'],
                acceptanceCriteria: [
                    'Team can draft and publish new articles directly from the CMS view',
                ],
                edgeCases: [
                    'Keep draft posts hidden from public landing views until status is published',
                ],
            },
        ],
        decisions: [
            {
                title: 'Built-in Lead Capture Over External Form Embeds',
                context: 'Third-party form iframes hurt mobile performance and brand consistency.',
                decision: 'Post leads directly to /api/v1/leads so the team owns the funnel and CRM.',
            },
        ],
        seedData: {
            leads: [
                { id: 'ld-1', name: 'Yara Hassan', email: 'yara@brightlabs.co', company: 'BrightLabs', source: 'Hero CTA', status: 'new' },
                { id: 'ld-2', name: 'Mostafa K.', email: 'mostafa@scaleup.io', company: 'ScaleUp', source: 'Referral', status: 'contacted' },
            ],
            posts: [
                { id: 'pst-1', title: 'Introducing Our Public Beta', category: 'Launch', summary: 'How we built our MVP in two weeks with a 3-person team.', status: 'published' },
            ],
        },
    },
};

export function listPlaybookSummaries() {
    return Object.values(PRODUCT_PLAYBOOKS).map((p) => ({
        id: p.id,
        name: p.name,
        tagline: p.tagline,
        category: p.category,
        accentColor: p.accentColor,
        recommendedRoles: p.recommendedRoles,
        stats: {
            models: p.models.length,
            apis: p.apis.length,
            pages: p.pages.length,
            slices: p.slices.length,
            edgeCases: p.slices.reduce((sum, s) => sum + s.edgeCases.length, 0),
        },
    }));
}

export function getPlaybook(archetype: string): ProductPlaybook {
    const key = archetype.toLowerCase() as ArchetypeId;
    return PRODUCT_PLAYBOOKS[key] || PRODUCT_PLAYBOOKS.ecommerce;
}

/**
 * Atomically bootstraps a project with a complete Small-Team Product Playbook:
 * - Data Models, REST APIs, Pages, Vertical Feature Slices, Decisions, Initial Kanban Tasks, and Live Mock API Seed Data.
 */
export async function bootstrapProjectFromPlaybook(params: {
    projectId: string;
    archetype: ArchetypeId;
    productName?: string;
    pitch?: string;
    selectedSliceKeys?: string[];
}) {
    const { projectId, archetype, productName, pitch, selectedSliceKeys } = params;
    const playbook = getPlaybook(archetype);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new Error(`Project ${projectId} not found`);

    // Clear prior generated blueprint entities so re-bootstrapping is clean & idempotent
    await Promise.all([
        prisma.dataModel.deleteMany({ where: { projectId } }),
        prisma.apiEndpoint.deleteMany({ where: { projectId } }),
        prisma.page.deleteMany({ where: { projectId } }),
        prisma.featureSlice.deleteMany({ where: { projectId } }),
        prisma.projectDecision.deleteMany({ where: { projectId } }),
        prisma.mockRecord.deleteMany({ where: { projectId } }),
        prisma.useCase.deleteMany({ where: { projectId } }),
    ]);

    // 1. Create Data Models
    const modelIdByName = new Map<string, string>();
    const createdModels: any[] = [];
    for (const m of playbook.models) {
        const schema = {
            description: m.description,
            resource: m.resource,
            fields: m.fields.map((f) => ({ id: f.name, ...f })),
            relations: m.relations,
        };
        const created = await prisma.dataModel.create({
            data: {
                projectId,
                name: m.name,
                schema: JSON.stringify(schema),
                archived: false,
            },
        });
        modelIdByName.set(m.name, created.id);
        createdModels.push(created);
    }

    // 2. Create REST APIs
    const apiIdByKey = new Map<string, string>();
    const createdApis: any[] = [];
    for (const a of playbook.apis) {
        const config = {
            description: a.description,
            entity: a.entity,
            request_body: (a.method === 'POST' || a.method === 'PUT' || a.method === 'PATCH') ? { shape_type: 'model', model_ref: a.entity } : null,
            response_body: { shape_type: a.method === 'GET' && !a.path.includes(':id') ? 'array' : 'object', model_ref: a.entity },
            query_params: a.method === 'GET' && !a.path.includes(':id') ? [{ name: 'search', param_type: 'string', required: false }, { name: 'status', param_type: 'string', required: false }] : [],
            path_params: a.path.includes(':id') ? [{ name: 'id', param_type: 'string', required: true }] : [],
        };
        const created = await prisma.apiEndpoint.create({
            data: {
                projectId,
                method: a.method,
                path: a.path,
                name: a.name,
                config: JSON.stringify(config),
                archived: false,
            },
        });
        apiIdByKey.set(`${a.method} ${a.path}`, created.id);
        createdApis.push(created);
    }

    // 3. Create Pages
    const pageIdByName = new Map<string, string>();
    const createdPages: any[] = [];
    for (const p of playbook.pages) {
        const pageId = randomUUID();
        const created = await prisma.page.create({
            data: {
                id: pageId,
                projectId,
                name: p.name,
                path: p.path,
                isDynamic: p.path.includes(':'),
                archived: false,
                meta: JSON.stringify({
                    title: p.name,
                    description: p.description,
                    pageType: p.type,
                    primaryEntity: p.primaryEntity,
                }),
            },
        });
        pageIdByName.set(p.name, created.id);
        createdPages.push(created);
    }

    // 4. Create Vertical Feature Slices (and derive Use Cases + Kanban Tasks)
    const activeSlices = selectedSliceKeys && selectedSliceKeys.length > 0
        ? playbook.slices.filter((s) => selectedSliceKeys.includes(s.key))
        : playbook.slices;

    const createdSlices: any[] = [];
    const teamTasks: any[] = [];

    for (const s of activeSlices) {
        const sliceId = `slice-${randomUUID().slice(0, 8)}`;
        const taskId = `task-${randomUUID().slice(0, 8)}`;

        const created = await prisma.featureSlice.create({
            data: {
                id: sliceId,
                projectId,
                key: s.key,
                title: s.title,
                summary: s.summary,
                lane: s.lane,
                status: s.lane === 'mvp' ? 'aligned' : 'proposed',
                owner: s.roleHint,
                dataModelIds: s.models.map((m) => modelIdByName.get(m)).filter(Boolean),
                apiIds: s.apis.map((a) => apiIdByKey.get(a)).filter(Boolean),
                pageIds: s.pages.map((p) => pageIdByName.get(p)).filter(Boolean),
                taskIds: [taskId],
                acceptanceCriteria: s.acceptanceCriteria.map((text, idx) => ({
                    id: `ac-${idx + 1}`,
                    text,
                    done: false,
                })),
                edgeCases: s.edgeCases.map((text, idx) => ({
                    id: `ec-${idx + 1}`,
                    text,
                    covered: false,
                })),
                votes: [{ member: 'Founder', vote: s.lane === 'mvp' ? 'mvp' : 'next' }],
            },
        });
        createdSlices.push(created);

        // Mirror into UseCases collection for backwards compatibility
        await prisma.useCase.create({
            data: {
                projectId,
                name: s.title,
                description: s.summary,
                actors: JSON.stringify([s.roleHint, 'End User']),
                preconditions: 'Feature slice aligned by team',
                postconditions: s.acceptanceCriteria[0] || 'Acceptance criteria verified',
                steps: JSON.stringify(s.acceptanceCriteria.map((c, idx) => ({ order: idx + 1, description: c }))),
                priority: s.lane === 'mvp' ? 'high' : 'medium',
                status: 'active',
                category: playbook.category,
                archived: false,
            },
        });

        // Create corresponding Kanban task linked to this slice
        teamTasks.push({
            id: taskId,
            title: `Build ${s.title}`,
            description: `${s.summary}\n\nAcceptance Criteria:\n- ${s.acceptanceCriteria.join('\n- ')}`,
            assignedTo: s.roleHint,
            status: 'todo',
            priority: s.lane === 'mvp' ? 'high' : 'medium',
            labels: [s.lane.toUpperCase(), playbook.id],
            sliceId,
            createdAt: new Date().toISOString(),
        });
    }

    // 5. Create Initial Architecture Decisions (ADRs)
    const createdDecisions: any[] = [];
    for (const d of playbook.decisions) {
        const created = await prisma.projectDecision.create({
            data: {
                projectId,
                title: d.title,
                context: d.context,
                decision: d.decision,
                author: 'Akasha Playbook',
                status: 'accepted',
            },
        });
        createdDecisions.push(created);
    }

    // 6. Seed Realistic Live Mock API Records
    let seededRecordsCount = 0;
    for (const [resource, rows] of Object.entries(playbook.seedData)) {
        for (const row of rows) {
            await prisma.mockRecord.create({
                data: {
                    projectId,
                    resource: resource.toLowerCase(),
                    recordId: String(row.id || randomUUID().slice(0, 8)),
                    data: row,
                },
            });
            seededRecordsCount += 1;
        }
    }

    // 7. Update Project Settings (Archetype, Share Token, Structured Idea Details, Tasks)
    const currentSettings = safeJsonParse<Record<string, any>>(project.settings, {});
    const resolvedName = (productName || project.name || playbook.name).trim();
    const resolvedPitch = (pitch || project.description || playbook.tagline).trim();
    const shareToken = currentSettings.shareToken || randomUUID().replace(/-/g, '').slice(0, 16);

    const updatedSettings = {
        ...currentSettings,
        archetype: playbook.id,
        archetypeName: playbook.name,
        accentColor: playbook.accentColor,
        shareToken,
        shareEnabled: true,
        teamTasks,
        ideaDetails: {
            ideaMetadata: {
                ideaName: resolvedName,
                tagline: playbook.tagline,
                summary: resolvedPitch,
            },
            problem: {
                problemStatement: `Small teams need a reliable, fast-to-ship ${playbook.name.toLowerCase()} without juggling fragmented specs, mockups, and broken APIs.`,
                urgencyLevel: 'High',
                painPoints: activeSlices.flatMap((s) => s.edgeCases).slice(0, 4),
            },
            solution: {
                coreInnovation: `Unified ${playbook.name} built around vertical Feature Slices and a live stateful prototype.`,
                valueProposition: resolvedPitch,
                productDescription: resolvedPitch,
            },
            product: {
                coreFeatures: activeSlices.map((s) => s.title),
            },
            targetMarket: {
                primaryUsers: playbook.recommendedRoles,
                geographicFocus: 'Global',
            },
            technicalArchitecture: {
                frontend: 'React 18 + Vite + Tailwind CSS',
                backend: 'Express 5 + TypeScript',
                database: 'MongoDB',
            },
            mvpPlan: {
                mvpGoal: `Ship ${activeSlices.filter(s => s.lane === 'mvp').length} MVP vertical slices with full test coverage.`,
            },
        },
    };

    await prisma.project.update({
        where: { id: projectId },
        data: {
            name: resolvedName,
            description: resolvedPitch,
            status: 'active',
            settings: JSON.stringify(updatedSettings),
        },
    });

    return {
        success: true,
        projectId,
        archetype: playbook.id,
        shareToken,
        stats: {
            modelsCount: createdModels.length,
            apisCount: createdApis.length,
            pagesCount: createdPages.length,
            slicesCount: createdSlices.length,
            decisionsCount: createdDecisions.length,
            tasksCount: teamTasks.length,
            seededRecordsCount,
        },
    };
}
