# Running Steps for Akasha Diagrams (Excalidraw)
To test and experiment directly with the newly integrated Semantic Software Architect (Excalidraw feature), follow these steps:

### 1. Install Global Dependencies (If missing)
Make sure you have Node Modules completely installed in both `client` and `server` folders. If you haven't recently installed the packages, navigate to the `Akasha` project root and run standard install:

```bash
cd .\client
npm install
cd ..\server
npm install
```

### 2. Start the Backend Server
The diagrams data flows through `diagramsController.ts` which accesses local files based on Prisma IDs. So, we need the server to be running.
By default, the NestJS / Express server should run on port `3000` (or `4000` depending on the `.env` settings).

```bash
cd .\server
npm run dev
```

### 3. Start the Frontend Client
In a new terminal window, spin up the Vite development server for the React application:

```bash
cd .\client
npm run dev
```

### 4. Interact With The UI
1. Open your browser and navigate to the localhost port provided by Vite (`http://localhost:5173`).
2. Log into the IDE interface, and open up the integrated `Diagrams` panel from the side navigation.
3. **Verify Fix**: Create a new diagram by clicking the top right `+` button, naming it `test-erd.excalidraw`. You shouldn't see a crashing screen as it is properly populated.
4. **Change Modes**: Ensure you can toggle between `Architecture`, `UseCase`, and `ERD`. Notice the tools changing based on mode.
5. **Draw Errors**: Pick the `UseCase` Mode stick-figure and the `Architecture` Mode database and connect an arrow between them. As soon as you complete the connection, the arrow will snap to `RED` due to the architectural linter rule and push a warning toast.
6. **Metadata**: Click on one of your figures and observe the "Semantic Metadata" right sidebar property panel. Modify its `componentName` and `APIMethod`.
7. **Generate Code**: Click the `⚡ Generate Code` button at the top header, and inspect your **Browser Console** (`F12`) to identify the structured JSON format successfully exported from your drawn architectural elements.
