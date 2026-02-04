# 🍇 Grapes Editor

A modern, production-ready visual web builder powered by **GrapesJS**, built with **React**, **TypeScript**, and **Tailwind CSS**.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)

---

## ✨ Features

### 🎨 Visual Editor
- **Drag & Drop Interface** – Intuitive block-based page building
- **GrapesJS Core** – Headless visual editor with full customization
- **Tailwind CSS Integration** – Built-in Tailwind support via `grapesjs-tailwind`
- **Responsive Design** – Device preview and breakpoint management
- **Code Preview Modal** – Live HTML, CSS, and React JSX code generation

### 🧩 Component Panels
| Panel | Description |
|-------|-------------|
| `AssetManager` | Upload and manage media assets |
| `AutoLayoutPanel` | Flexbox and grid layout controls |
| `AnimationPanel` | Animation configuration |
| `CodeInjectionPanel` | Custom code injection |
| `CollaborationPanel` | Real-time multi-user collaboration |
| `DataModelPanel` | Data binding and modeling |
| `EcommercePanel` | E-commerce components |
| `LogicPanel` | Visual logic flow builder |
| `MarketplacePanel` | Templates and plugins marketplace |
| `PageManager` | Multi-page project management |
| `PublishingPanel` | One-click publishing workflow |
| `SEOPanel` | SEO meta tag management |
| `StyleInspector` | CSS property inspector |
| `SymbolPanel` | Reusable component symbols |
| `VersionHistoryPanel` | Version control and rollback |
| `AccessibilityPanel` | A11y audit and improvements |
| `AnalyticsPanel` | Integrated analytics tracking |

### 🛠️ Advanced Features
- **Logic Graph Engine** – Visual state and event management
- **CSS-to-Tailwind Conversion** – Automatic Tailwind class generation
- **React Code Export** – Export projects as production-ready React apps
- **Real-time Collaboration** – WebSocket-based multi-user editing with comments
- **Virtual File System (VFS)** – File management with version control and block ownership
- **Hot Reload Support** – Instant preview updates
- **Multi-Platform Publishing** – Deploy to Vercel, Netlify, and more
- **E-commerce Integration** – Stripe and PayPal payment processing

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **MongoDB** (via Docker or local installation)

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd grapes-editor
```

### 2. Install Dependencies

```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Or install individually
cd frontend && npm install
cd ../backend && npm install
```

### 3. Environment Configuration

Create `.env` files in both `frontend/` and `backend/` directories:

**`backend/.env`**
```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/grapes-editor

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Optional: PostgreSQL (if using Sequelize features)
POSTGRES_URL=postgresql://user:password@localhost:5432/grapes_editor
# OR use individual connection parameters:
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=grapes_editor
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password

# Publishing Providers (Optional)
VERCEL_TOKEN=your-vercel-token
NETLIFY_TOKEN=your-netlify-token

# Payment Providers (Optional)
STRIPE_SECRET_KEY=your-stripe-secret-key
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_BASE_URL=https://api-m.sandbox.paypal.com
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000/ws
```

### 4. Start MongoDB (Docker)

```bash
docker-compose up -d
```

### 5. Run the Development Server

```bash
# Run both frontend and backend concurrently
npm run dev

# Or run individually
npm run frontend  # Starts Vite dev server on http://localhost:5173
npm run backend   # Starts Express server on http://localhost:5000
```

---

## 📁 Project Structure

```
grapes-editor/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/       # UI Components
│   │   │   ├── Editor/       # Main GrapesJS editor wrapper
│   │   │   ├── Toolbar/      # Editor toolbar
│   │   │   ├── FileTree/     # File navigator
│   │   │   └── ...           # Other panels
│   │   ├── context/          # React Context providers
│   │   │   ├── AuthContext.tsx
│   │   │   ├── ProjectContext.tsx
│   │   │   ├── LogicContext.tsx
│   │   │   └── CollaborationContext.tsx
│   │   ├── hooks/            # Custom React hooks
│   │   ├── pages/            # Route pages (Auth, Preview)
│   │   ├── services/         # API service layer
│   │   ├── utils/            # Utility functions
│   │   │   ├── blocks.ts     # Block definitions
│   │   │   ├── schema.ts     # Data schemas
│   │   │   ├── css-to-tailwind.ts
│   │   │   ├── logic-graph-engine.ts
│   │   │   └── generator/    # React code generator
│   │   ├── styles/           # Global CSS
│   │   └── types/            # TypeScript type definitions
│   └── package.json
│
├── backend/                  # Express + TypeScript backend
│   ├── src/
│   │   ├── config/           # Database configurations
│   │   ├── controllers/      # Route controllers
│   │   ├── middleware/       # Express middleware
│   │   ├── models/           # Mongoose & Sequelize models
│   │   ├── routes/           # API route definitions
│   │   ├── vfs/              # Virtual File System logic
│   │   └── server.ts         # Main server entry
│   └── package.json
│
├── docker-compose.yml        # MongoDB container setup
├── package.json              # Root package with workspace scripts
└── README.md
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | User login |

### Projects
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/projects` | List user projects |
| `POST` | `/api/projects` | Create new project |
| `GET` | `/api/projects/:id` | Get project details |
| `PUT` | `/api/projects/:id` | Update project |
| `DELETE` | `/api/projects/:id` | Archive project |

### Pages
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pages/:projectId` | List project pages |
| `POST` | `/api/pages` | Create new page |
| `PUT` | `/api/pages/:id` | Update page content |

### Additional APIs
- `/api/symbols` – Reusable component symbols
- `/api/forms` – Form submissions
- `/api/cms` – CMS content management (collections, items)
- `/api/products` – Product catalog management
- `/api/commerce` – E-commerce cart and checkout (Stripe/PayPal)
- `/api/analytics` – Analytics events tracking
- `/api/publish` – Publishing workflow (Vercel/Netlify deployment)
- `/api/templates` – Page templates
- `/api/shared` – Shared components
- `/api/vfs` – Virtual file system operations (files, blocks, versions)

---

## 🧪 Scripts Reference

### Root (`package.json`)
```bash
npm run dev           # Run frontend + backend concurrently
npm run frontend      # Run frontend only
npm run backend       # Run backend only
npm run build:frontend # Build frontend for production
npm run build:backend  # Build backend for production
npm run install:all   # Install all dependencies
```

### Frontend (`frontend/package.json`)
```bash
npm run dev      # Start Vite dev server
npm run build    # TypeScript compile + Vite build
npm run preview  # Preview production build
npm run lint     # ESLint check
```

### Backend (`backend/package.json`)
```bash
npm run dev    # Start with nodemon (hot reload)
npm run build  # TypeScript compile
npm run start  # Run compiled production server
```

---

## 🐳 Docker Deployment

### Development
```bash
docker-compose up -d  # Start MongoDB on port 27017
npm run dev           # Start application (frontend: 5173, backend: 5000)
```

### Production (Example)
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  mongo:
    image: mongo:latest
    restart: always
    volumes:
      - mongo_data:/data/db

  backend:
    build: ./backend
    environment:
      - MONGODB_URI=mongodb://mongo:27017/grapes-editor
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    depends_on:
      - backend

volumes:
  mongo_data:
```

---

## 🔒 Security Considerations

- **JWT Authentication** – All protected routes require valid JWT tokens
- **Password Hashing** – bcryptjs for secure password storage
- **Helmet.js** – Security headers enabled
- **CORS** – Configured for allowed origins
- **Input Validation** – Server-side validation on all endpoints
- **Environment Variables** – Secrets stored in `.env` files (never committed)
- **WebSocket Authentication** – JWT-based connection validation for real-time features

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- **TypeScript** – Strict mode enabled
- **ESLint** – Linting enforced
- **Tailwind CSS** – Utility-first styling
- **Atomic Design** – Component modularity

---

## 📜 License

This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [GrapesJS](https://grapesjs.com/) – The core visual editor
- [React](https://react.dev/) – UI framework
- [Vite](https://vitejs.dev/) – Build tool
- [Tailwind CSS](https://tailwindcss.com/) – Styling
- [Lucide Icons](https://lucide.dev/) – Icon library

---

<p align="center">
  Made with ❤️ by Mohamed Tarek
</p>
