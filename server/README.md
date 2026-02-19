# Akasha Server

The backend API for the Akasha platform, built with **Node.js**, **Express**, and **Prisma**.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite
- **ORM**: Prisma
- **Language**: TypeScript
- **File System**: `fs-extra` for project file management

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- npm

### Installation

```bash
npm install
```

### Development

Start the development server with hot-reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3001`.

## 🗄️ Database

The project uses a local SQLite database located at `prisma/dev.db`.

### Prisma Commands

- **Generate Client**: `npx prisma generate`
- **Push Schema**: `npx prisma db push`
- **Studio**: `npx prisma studio` (Open database GUI)

## 📁 Project Structure

- `src/routes/`: API route controllers.
- `src/services/`: Business logic and data handling.
- `src/utils/`: Utility functions.
- `prisma/`: Database schema (`schema.prisma`) and migrations.
