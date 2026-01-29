import React from 'react';
import { Users, WifiOff, Wifi } from 'lucide-react';
import { useCollaboration } from '../../context/useCollaboration';

export const CollaborationPanel: React.FC = () => {
    const { users, isConnected } = useCollaboration();

    return (
        <div className="p-4 text-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Users size={18} />
                    Collaboration
                </h3>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                    {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {isConnected ? 'Online' : 'Offline'}
                </span>
            </div>

            {users.length === 0 && (
                <div className="text-slate-400 text-sm">No collaborators connected.</div>
            )}

            <div className="space-y-2">
                {users.map((user) => (
                    <div
                        key={user.userId}
                        className="flex items-center justify-between p-2 rounded bg-[#141428] border border-[#2a2a4a]"
                    >
                        <span className="text-sm text-slate-200">{user.username}</span>
                        <span className="text-[11px] text-slate-400">{user.userId.slice(0, 6)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
