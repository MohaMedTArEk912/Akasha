import { useContext } from 'react';
import { CollaborationContextInstance } from './CollaborationContext';

export const useCollaboration = () => {
    const context = useContext(CollaborationContextInstance);
    if (!context) {
        throw new Error('useCollaboration must be used within a CollaborationProvider');
    }
    return context;
};
