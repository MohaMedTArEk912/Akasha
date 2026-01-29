import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LogicProvider } from './context/LogicContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { CollaborationProvider } from './context/CollaborationContext';
import { Editor } from './components/Editor';
import { Login } from './pages/Auth/Login';
import { Register } from './pages/Auth/Register';

// Protected Route Wrapper
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#0f0f23] text-white">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <ProjectProvider>
                    <CollaborationProvider>
                        <LogicProvider>
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route
                                    path="/"
                                    element={
                                        <ProtectedRoute>
                                            <Editor />
                                        </ProtectedRoute>
                                    }
                                />
                            </Routes>
                        </LogicProvider>
                    </CollaborationProvider>
                </ProjectProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;
