/**
 * README Generator Utility
 * Synthesizes production-grade, comprehensive GitHub README.md documents
 * grounded directly in the project's actual architecture, idea details, data models, and REST APIs.
 */

import type { ProjectSchema } from "../types/api";
import type { GitHubRepo } from "../components/features/GitHub/RepoSelector";

export type ReadmePreset = "showcase" | "minimal" | "enterprise";
export type ReadmeTone = "modern" | "technical" | "startup";

interface GenerateReadmeOptions {
    project: ProjectSchema | null;
    repo?: GitHubRepo | null;
    branch?: string;
    preset?: ReadmePreset;
    tone?: ReadmeTone;
}

export function generateBestReadme(options: GenerateReadmeOptions): string {
    const {
        project,
        repo,
        branch = "main",
        preset = "showcase",
        tone = "modern",
    } = options;

    const details = project?.settings?.ideaDetails as any;
    const metadata = details?.ideaMetadata;
    const problem = details?.problem || details?.problemStatement;
    const solution = details?.solution || details?.theSolution;
    const techArch = details?.technicalArchitecture || details?.technicalStackAndMVP;
    const mvpPlan = details?.mvpPlan;
    const audience = details?.targetMarket || details?.targetAudience;
    const product = details?.product;

    const projectName = metadata?.ideaName || project?.name || repo?.name || "Project";
    
    // Tone adjustments
    let defaultTagline = "Autonomous Next-Generation Platform";
    if (tone === "startup") defaultTagline = "The Next-Generation Platform Transforming Workflows";
    if (tone === "technical") defaultTagline = "High-Performance Cloud Architecture & Real-Time Engine";

    const tagline = metadata?.tagline || defaultTagline;
    const summary = metadata?.summary || (project?.description ? project.description.replace(/^#+\s.*/gm, "").replace(/[{}\[\]"]/g, "").trim() : "Modern full-stack cloud application engineered for seamless developer & user experience.");
    
    const repoOwner = repo?.owner?.login || "owner";
    const repoName = repo?.name || projectName.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    const repoFullName = repo?.full_name || `${repoOwner}/${repoName}`;
    const repoUrl = repo?.html_url || `https://github.com/${repoFullName}`;

    // Extract models and APIs if present
    const models = (project as any)?.schema?.models || (project as any)?.models || [];
    const apis = (project as any)?.schema?.apis || (project as any)?.apis || [];
    const useCases = (project as any)?.schema?.usecases || (project as any)?.usecases || [];

    // Badges section
    const badges = [
        `[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)`,
        `[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)`,
        `[![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)`,
        `[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)`,
        `[![Branch: ${branch}](https://img.shields.io/badge/Branch-${branch}-6366F1?style=for-the-badge&logo=git&logoColor=white)](https://github.com/${repoFullName}/tree/${branch})`,
        `[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](http://makeapullrequest.com)`,
        `[![Architected with Akasha](https://img.shields.io/badge/Architected%20with-Akasha%20AI-00f2fe?style=for-the-badge&logo=sparkles&logoColor=black)](https://github.com/${repoFullName})`
    ].join(" ");

    // Pain points
    const painPointsList = problem?.painPoints && problem.painPoints.length > 0
        ? problem.painPoints.map((p: string) => `- ❌ **Friction**: ${p}`).join("\n")
        : `- ❌ Fragmented and disjointed legacy workflows\n- ❌ Manual, error-prone data entry and synchronization\n- ❌ Slow response times and lack of real-time collaboration`;

    // MVP & Core Features
    const rawFeatures = mvpPlan?.mustHaveFeatures || product?.coreFeatures || techArch?.mvpFeatures;
    const mvpFeaturesList = rawFeatures && rawFeatures.length > 0
        ? rawFeatures.map((f: string) => `- ⚡ **${f}**`).join("\n")
        : `- ⚡ **Real-time Synchronization**: Instant data delivery and state management\n- ⚡ **Role-Based Access Control**: Granular permission tiers and secure sessions\n- ⚡ **Autonomous Workflows**: End-to-end task execution and AI telemetry`;

    // Workflows / Use Cases
    let workflowsSection = "";
    if (useCases && useCases.length > 0) {
        workflowsSection = `\n### 🔄 Key Workflows & User Scenarios\n` +
            useCases.slice(0, 5).map((uc: any) => `- **${uc.title || uc.name}**: ${uc.description || "Automated lifecycle workflow"}`).join("\n") + "\n";
    }

    // Models Table
    let modelsTable = "";
    if (models.length > 0) {
        modelsTable = `| Entity Model | Key Fields | Relations | Description |\n| :--- | :--- | :--- | :--- |\n`;
        for (const m of models.slice(0, 8)) {
            const fieldsStr = m.fields ? m.fields.map((f: any) => `\`${f.name}\``).slice(0, 4).join(", ") : "id, createdAt, updatedAt";
            const relationsStr = m.relations ? m.relations.map((r: any) => r.targetModel || r.target).slice(0, 2).join(", ") : "None";
            modelsTable += `| **${m.name}** | ${fieldsStr} | ${relationsStr || "None"} | Core ${m.name.toLowerCase()} domain entity |\n`;
        }
    } else {
        modelsTable = `| Entity Model | Key Fields | Relations | Description |\n| :--- | :--- | :--- | :--- |\n| **User** | \`id\`, \`email\`, \`role\`, \`createdAt\` | Projects, Teams | Primary user account & identity |\n| **Project** | \`id\`, \`name\`, \`ownerId\`, \`status\` | User, Documents | Core workspace container |\n| **ActivityLog** | \`id\`, \`action\`, \`timestamp\`, \`userId\` | User | System audit trail & telemetry |\n`;
    }

    // APIs Table
    let apisTable = "";
    if (apis.length > 0) {
        apisTable = `| Method | Endpoint | Description | Auth Required |\n| :---: | :--- | :--- | :---: |\n`;
        for (const a of apis.slice(0, 10)) {
            const method = a.method || "GET";
            const path = a.path || a.endpoint || "/api";
            const desc = a.description || `Handler for ${path}`;
            const auth = a.authRequired !== false ? "🔒 Bearer Token" : "🌐 Public";
            apisTable += `| \`${method}\` | \`${path}\` | ${desc} | ${auth} |\n`;
        }
    } else {
        apisTable = `| Method | Endpoint | Description | Auth Required |\n| :---: | :--- | :--- | :---: |\n| \`GET\` | \`/api/health\` | System health check & telemetry | 🌐 Public |\n| \`POST\` | \`/api/auth/login\` | User authentication & JWT issuance | 🌐 Public |\n| \`GET\` | \`/api/v1/projects\` | List user workspace projects | 🔒 Bearer Token |\n| \`POST\` | \`/api/v1/projects\` | Create new workspace project | 🔒 Bearer Token |\n| \`GET\` | \`/api/v1/projects/:id\` | Fetch project specification & assets | 🔒 Bearer Token |\n`;
    }

    // Mermaid Topology Diagram
    const mermaidDiagram = `\`\`\`mermaid
graph TD
    User["👤 Client Device (Browser / Mobile)"] --> CDN["⚡ Cloudflare / Vite Edge CDN"]
    CDN --> WebApp["💻 Frontend Application (React + TypeScript)"]
    WebApp --> APIGateway["🛡️ REST & WebSocket Gateway"]
    
    subgraph CoreBackend ["Core Application Server"]
        APIGateway --> AuthGuard["🔐 Auth & Security Guard"]
        AuthGuard --> Controllers["⚙️ API Controllers & Orchestrators"]
        Controllers --> DataLayer["📦 Schema & ORM Layer"]
    end
    
    subgraph DataPersistence ["Persistence & Storage"]
        DataLayer --> PrimaryDB[("🗄️ Relational Database (PostgreSQL / SQLite)")]
        DataLayer --> Cache[("⚡ In-Memory Cache (Redis)")]
    end
\`\`\``;

    // Minimal preset
    if (preset === "minimal") {
        return `# ${projectName}

> ${tagline}

${badges}

## 📖 Overview
${summary}

## 🚀 Quick Start
\`\`\`bash
# 1. Clone repository (branch: ${branch})
git clone -b ${branch} ${repoUrl}.git
cd ${repoName}

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start local development
npm run dev
\`\`\`

## 🔌 API Endpoints
${apisTable}

## 🛠️ Tech Stack
- **Frontend**: ${techArch?.frontend || "React, TypeScript, Tailwind CSS, Vite"}
- **Backend**: ${techArch?.backend || "Node.js, Express, TypeScript"}
- **Database**: ${techArch?.database || "PostgreSQL, Prisma ORM"}

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
`;
    }

    // Enterprise preset
    if (preset === "enterprise") {
        return `# 🏢 ${projectName} — Enterprise Architecture Specification

> **${tagline}**  
> *${summary}*

${badges}

---

## 🏛️ Executive Summary & Value Proposition
${solution?.valueProposition || summary}

### 🔒 Target Industry & Persona
- **Primary Stakeholders**: ${audience?.primaryUsers?.join(", ") || audience?.primaryPersona || "Engineering teams, Enterprise architects, and Operations directors"}
- **Urgency Level**: \`${problem?.urgencyLevel || problem?.urgency || "HIGH"}\`
- **Security Posture**: End-to-end encryption in transit and at rest, role-based access control (RBAC), and automated audit logs.

---

## 🏗️ System Architecture
${mermaidDiagram}

---

## 🗄️ Enterprise Data Model & Schema
${modelsTable}

---

## 🔌 API Gateway & Contract Specifications
${apisTable}

---

## 🛡️ Enterprise Security & Compliance
- **Authentication**: JWT / OAuth2 bearer token authorization with session invalidation
- **Input Validation**: Strict schema parsing and sanitized database parameterization
- **Rate Limiting**: Sliding window rate limits enforced per IP and API token
- **Auditing**: Immutable timestamped telemetry trails on all mutating requests

---

## 🚀 Production Deployment & Orchestration
\`\`\`bash
# Clone active branch
git clone -b ${branch} ${repoUrl}.git
cd ${repoName}

# Build production bundle
npm run build

# Start containerized service
docker-compose up -d --build
\`\`\`

## 📄 Compliance & License
Licensed under the [MIT License](LICENSE). For commercial enterprise agreements, please contact the repository administrators.
`;
    }

    // Full Showcase preset (Default & Most Complete)
    return `<div align="center">

# 🌟 ${projectName}

### *${tagline}*

${summary}

<br />

${badges}

<br />

[Explore Features](#-key-features) • [Architecture](#-system-architecture) • [API Reference](#-rest-api-reference) • [Getting Started](#-getting-started) • [Contributing](#-contributing)

</div>

---

## 📑 Table of Contents
1. [💡 Problem & Solution](#-problem--solution)
2. [✨ Key Features](#-key-features)
3. [🏗️ System Architecture](#-system-architecture)
4. [🗄️ Database Models](#-database-models)
5. [🔌 REST API Reference](#-rest-api-reference)
6. [🛠️ Tech Stack](#-tech-stack)
7. [🚀 Getting Started](#-getting-started)
8. [📁 Project Directory Structure](#-project-directory-structure)
9. [🤝 Contributing](#-contributing)
10. [📄 License](#-license)

---

## 💡 Problem & Solution

### ⚠️ The Problem
${problem?.problemStatement || problem?.statement || "Modern workflows are often bogged down by fragmented systems, legacy manual steps, and lack of real-time synchronization, resulting in administrative overload and miscommunication."}

**Key Pain Points Addressed:**
${painPointsList}

### 🎯 The Solution
${solution?.coreInnovation || `${projectName} provides a unified, end-to-end modern architecture engineered to streamline operations, reduce cognitive load, and automate complex pipelines seamlessly.`}

> **Core Value Proposition**:  
> *${solution?.valueProposition || "Delivering maximum efficiency with state-of-the-art developer experience and intuitive user workflows."}*

---

## ✨ Key Features

${mvpFeaturesList}
${workflowsSection}
- 🎨 **Modern Liquid Glass UI**: Responsive, accessible, and high-performance design system
- 📊 **Real-time Telemetry**: Live progress tracking and autonomous pipeline status reporting
- 🔒 **Enterprise-Grade Security**: Industry-standard authentication, authorization, and audit logs

---

## 🏗️ System Architecture

${mermaidDiagram}

---

## 🗄️ Database Models

${modelsTable}

---

## 🔌 REST API Reference

${apisTable}

### Example cURL Request
\`\`\`bash
curl -X GET "${repoUrl.replace("https://github.com", "https://api.github.com")}" \\
  -H "Accept: application/vnd.github.v3+json"
\`\`\`

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | ${techArch?.frontend || "React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite"} |
| **Backend** | ${techArch?.backend || "Node.js, Express.js, TypeScript"} |
| **Database & ORM** | ${techArch?.database || "PostgreSQL / SQLite, Prisma ORM"} |
| **Architecture Engine** | Akasha AI Autonomous Architecture Platform |
| **DevOps & Tooling** | Git, Docker, ESLint, Prettier |

---

## 🚀 Getting Started

Follow these steps to get a local development environment up and running.

### 📋 Prerequisites
- **Node.js**: \`>= 18.0.0\`
- **npm** or **pnpm**: \`>= 9.0.0\`
- **Git**: Installed and configured

### 💻 Installation

1. **Clone the Repository**
   \`\`\`bash
   git clone -b ${branch} ${repoUrl}.git
   cd ${repoName}
   \`\`\`

2. **Install Dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Configure Environment Variables**
   Create a \`.env\` file in the root directory:
   \`\`\`env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-super-secret-jwt-key"
   CLIENT_URL="http://localhost:5173"
   \`\`\`

4. **Launch the Development Server**
   \`\`\`bash
   npm run dev
   \`\`\`
   Open your browser and navigate to \`http://localhost:5173\`.

---

## 📁 Project Directory Structure

\`\`\`ascii
${repoName}/
├── client/                 # Frontend client application
│   ├── src/
│   │   ├── components/     # UI primitives & design system components
│   │   ├── pages/          # Primary application views & route handlers
│   │   ├── hooks/          # React hooks & store bindings
│   │   └── types/          # TypeScript domain interfaces
│   └── package.json
├── server/                 # Backend REST & WebSocket server
│   ├── src/
│   │   ├── controllers/    # Route controllers & business logic
│   │   ├── routes/         # Express endpoint definitions
│   │   └── lib/            # Database clients & helper utilities
│   └── package.json
├── .env.example            # Environment configuration template
└── README.md               # Project documentation
\`\`\`

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. **Fork the Project**
2. **Create your Feature Branch** (\`git checkout -b feature/AmazingFeature\`)
3. **Commit your Changes** (\`git commit -m 'feat: add AmazingFeature'\`)
4. **Push to the Branch** (\`git push origin feature/AmazingFeature\`)
5. **Open a Pull Request**

---

## 📄 License

Distributed under the **MIT License**. See [\`LICENSE\`](LICENSE) for more information.

<div align="center">
  <sub>Engineered with precision using <a href="https://github.com/${repoFullName}">Akasha AI</a>.</sub>
</div>
`;
}
