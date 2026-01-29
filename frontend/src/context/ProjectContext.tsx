import React, { createContext, useContext, useState } from 'react';
import { ProjectData } from '../services/projectService';

interface ProjectContextType {
    currentProject: ProjectData | null;
    setCurrentProject: (project: ProjectData | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentProject, setCurrentProject] = useState<ProjectData | null>(null);

    return (
        <ProjectContext.Provider value={{ currentProject, setCurrentProject }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};