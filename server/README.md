# Akasha Server

The backend API for the Akasha platform, built with **Node.js**, **Express**, and **MongoDB**.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
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

The project uses MongoDB with the connection string configured in `.env` using `DATABASE_URL`.

## 📁 Project Structure

- `src/routes/`: API route controllers.
- `src/services/`: Business logic and data handling.
- `src/utils/`: Utility functions.
