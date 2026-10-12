import React from 'react';
import { Cpu } from 'lucide-react';
import type { SquadMember, ExecutionMode } from '../../../types/agentSquad';
import { SquadMemberCard } from './SquadMemberCard';

interface SquadMemberListProps {
    members: SquadMember[];
    executionMode: ExecutionMode;
}

export const SquadMemberList: React.FC<SquadMemberListProps> = ({ members, executionMode }) => {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                        Squad Execution Topology: {executionMode === 'parallel' ? 'Parallel Team (Split & Merge)' : 'Series Pipeline (Sequential)'}
                    </h2>
                </div>
                <span className="text-xs text-slate-400">{members.length} Autonomous Specialized Roles</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {members.map((member) => (
                    <SquadMemberCard key={member.id} member={member} />
                ))}
            </div>
        </div>
    );
};
