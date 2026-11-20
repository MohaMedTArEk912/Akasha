import React from "react";
import { Cpu } from "lucide-react";
import type { SquadMember, ExecutionMode } from "../../../types/agentSquad";
import { SquadMemberCard } from "./SquadMemberCard";

interface SquadMemberListProps {
  members: SquadMember[];
  executionMode: ExecutionMode;
}

export const SquadMemberList: React.FC<SquadMemberListProps> = ({ members, executionMode }) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#1B5BFF] dark:text-[#7AA3FF]" />
          <h2 className="text-sm font-bold text-[var(--ide-text)]">
            Agent roles ({executionMode === "parallel" ? "Parallel execution" : "Sequential pipeline"})
          </h2>
        </div>
        <span className="text-xs text-[var(--ide-text-muted)]">{members.length} active roles</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {members.map((member) => (
          <SquadMemberCard key={member.id} member={member} />
        ))}
      </div>
    </div>
  );
};
