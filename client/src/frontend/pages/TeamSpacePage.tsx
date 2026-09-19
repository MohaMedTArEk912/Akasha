import React, { useState, useEffect } from "react";
import { useProjectStore } from "../hooks/useProjectStore";
import { updateProjectSettings } from "../stores/projectStore";
import { useToast } from "../context/ToastContext";
import { TeamTask } from "../types/api";

interface Member {
    id?: string;
    username: string;
    displayName?: string;
    role: string;
    jobTitle?: string;
    skillTags?: string[];
    avatarUrl?: string;
    email?: string;
    orgRole?: string;
}

// Generate premium gradients for member avatars deterministically
const getMemberAvatarStyle = (username: string) => {
    if (username.toLowerCase() === "all" || username.toLowerCase() === "whole team") {
        return "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white border-indigo-400/20 shadow-[0_0_10px_rgba(99,102,241,0.15)]";
    }
    
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const gradients = [
        "from-indigo-500 to-purple-600 text-white border-indigo-400/20",
        "from-rose-500 to-orange-600 text-white border-rose-400/20",
        "from-emerald-500 to-teal-600 text-white border-emerald-400/20",
        "from-cyan-500 to-blue-600 text-white border-cyan-400/20",
        "from-amber-500 to-yellow-600 text-white border-amber-400/20",
        "from-fuchsia-500 to-pink-600 text-white border-fuchsia-400/20",
        "from-violet-500 to-indigo-600 text-white border-violet-400/20",
        "from-lime-500 to-emerald-600 text-white border-lime-400/20"
    ];
    
    const index = Math.abs(hash) % gradients.length;
    return `bg-gradient-to-r ${gradients[index]}`;
};

const getInitials = (username: string) => {
    if (username.toLowerCase() === "all" || username.toLowerCase() === "whole team") {
        return "ALL";
    }
    return username.slice(0, 2).toUpperCase();
};

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
    critical: { label: "CRITICAL", bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
    high: { label: "HIGH", bg: "bg-orange-500/15", text: "text-orange-400", border: "border-orange-500/30" },
    medium: { label: "MEDIUM", bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
    low: { label: "LOW", bg: "bg-gray-500/15", text: "text-gray-400", border: "border-gray-500/30" },
};

export default function TeamSpacePage() {
    const { project } = useProjectStore();
    const toast = useToast();

    // Local state
    const [dbMembers, setDbMembers] = useState<Member[]>([]);
    const [activeFilter, setActiveFilter] = useState<string>("all"); // "all", "team", or a username
    const [aiGenerating, setAiGenerating] = useState(false);
    const [draggedOverColumn, setDraggedOverColumn] = useState<'todo' | 'in_progress' | 'done' | null>(null);

    // Modal/Form states
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskAssignee, setNewTaskAssignee] = useState("All");

    const [newMemberName, setNewMemberName] = useState("");
    const [showAddMember, setShowAddMember] = useState(false);

    // Edit task states
    const [showEditTask, setShowEditTask] = useState(false);
    const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
    const [editTaskTitle, setEditTaskTitle] = useState("");
    const [editTaskDesc, setEditTaskDesc] = useState("");
    const [editTaskAssignee, setEditTaskAssignee] = useState("All");
    const [editTaskStatus, setEditTaskStatus] = useState<'todo' | 'in_progress' | 'done'>("todo");

    // Extended task fields
    const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
    const [newTaskDueDate, setNewTaskDueDate] = useState("");
    const [newTaskLabels, setNewTaskLabels] = useState("");
    const [newTaskStoryPoints, setNewTaskStoryPoints] = useState("");

    const [editTaskPriority, setEditTaskPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
    const [editTaskDueDate, setEditTaskDueDate] = useState("");
    const [editTaskLabels, setEditTaskLabels] = useState("");
    const [editTaskStoryPoints, setEditTaskStoryPoints] = useState("");

    const [taskSearch, setTaskSearch] = useState("");
    const [taskSort, setTaskSort] = useState<'created' | 'priority' | 'dueDate'>('created');

    // Get session ID
    const sessionId = localStorage.getItem("akasha_user_session") || "akasha_user_temp";

    // Org members fetched from the organization attached to the current project
    const [orgMembers, setOrgMembers] = useState<Member[]>([]);
    const [orgName, setOrgName] = useState<string | null>(null);

    // Fetch organization members for the current project
    const fetchOrgMembers = async () => {
        if (!project?.id) return;
        try {
            const token = localStorage.getItem("akasha_token") || localStorage.getItem("token") || "";
            const res = await fetch(`/api/akasha/ai/org-members?projectId=${project.id}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            if (res.ok) {
                const data = await res.json();
                setOrgName(data.orgName || null);
                if (data.members && data.members.length > 0) {
                    setOrgMembers(data.members);
                    return;
                }
            }
        } catch (err) {
            console.error("Failed to fetch org members:", err);
        }
        setOrgMembers([]);
    };

    // Fallback: fetch legacy team members if org has no members
    const fetchTeamMembers = async () => {
        try {
            const token = localStorage.getItem("akasha_token") || localStorage.getItem("token") || "";
            const res = await fetch(`/api/akasha/ai/team-members?sessionId=${sessionId}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined
            });
            if (res.ok) {
                const data = await res.json();
                if (data.members && data.members.length > 0) {
                    setDbMembers(data.members);
                } else {
                    setDbMembers([]);
                }
            }
        } catch (err) {
            console.error("Failed to fetch team members:", err);
        }
    };

    useEffect(() => {
        fetchOrgMembers();
        fetchTeamMembers();
    }, [project?.id, sessionId]);

    // Active members list — merge org members + custom members + DB members
    const members: Member[] = React.useMemo(() => {
        const seen = new Set<string>();
        const result: Member[] = [];

        // 1. Organization members
        for (const m of orgMembers) {
            result.push({
                id: m.id,
                username: m.username,
                displayName: m.displayName || m.username,
                role: project?.settings?.teamRoles?.[m.username] || m.jobTitle || m.role || "Developer",
                jobTitle: m.jobTitle,
                skillTags: m.skillTags,
                avatarUrl: m.avatarUrl,
                email: m.email,
                orgRole: m.orgRole,
            });
            seen.add(m.username.toLowerCase());
        }

        // 2. Custom members (from Add Member button) — skip duplicates
        const custom = project?.settings?.customMembers || [];
        for (const username of custom) {
            if (!seen.has(username.toLowerCase())) {
                result.push({
                    username,
                    role: project?.settings?.teamRoles?.[username] || "Developer"
                });
                seen.add(username.toLowerCase());
            }
        }

        // 3. Legacy DB team members — skip duplicates
        for (const m of dbMembers) {
            if (!seen.has(m.username.toLowerCase())) {
                result.push({
                    username: m.username,
                    role: project?.settings?.teamRoles?.[m.username] || m.role || "Developer"
                });
                seen.add(m.username.toLowerCase());
            }
        }

        return result;
    }, [orgMembers, dbMembers, project?.settings?.customMembers, project?.settings?.teamRoles]);

    // Roles choices
    const ROLE_OPTIONS = [
        "Project Lead",
        "Frontend Engineer",
        "Backend Engineer",
        "Fullstack Engineer",
        "UI/UX Designer",
        "QA Engineer",
        "Product Manager",
        "Developer"
    ];

    // Handle role update
    const handleUpdateRole = async (username: string, role: string) => {
        try {
            const currentRoles = project?.settings?.teamRoles || {};
            const updatedRoles = {
                ...currentRoles,
                [username]: role
            };
            await updateProjectSettings({ teamRoles: updatedRoles });
            toast.showToast(`Updated role for ${username} to ${role}`, "success");
        } catch (err) {
            toast.showToast("Failed to update role", "error");
        }
    };

    // Handle adding custom local member
    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newMemberName.trim();
        if (!name) return;

        if (members.some(m => m.username.toLowerCase() === name.toLowerCase())) {
            toast.showToast("Member already exists", "error");
            return;
        }

        try {
            const currentCustom = project?.settings?.customMembers || [];
            const updatedCustom = [...currentCustom, name];

            await updateProjectSettings({ customMembers: updatedCustom });
            setNewMemberName("");
            setShowAddMember(false);
            toast.showToast(`Added team member ${name}`, "success");
        } catch (err) {
            toast.showToast("Failed to add member", "error");
        }
    };

    // Handle removing custom local member
    const handleRemoveMember = async (username: string) => {
        if (dbMembers.length > 0) {
            toast.showToast("Cannot remove members of a database-backed team here.", "error");
            return;
        }
        try {
            const currentCustom = project?.settings?.customMembers || [];
            const updatedCustom = currentCustom.filter((name: string) => name !== username);
            
            const currentRoles = project?.settings?.teamRoles || {};
            const updatedRoles = { ...currentRoles };
            delete updatedRoles[username];

            const currentTasks = project?.settings?.teamTasks || [];
            const updatedTasks = currentTasks.map((t: TeamTask) => 
                t.assignedTo === username ? { ...t, assignedTo: "All" } : t
            );

            await updateProjectSettings({ 
                customMembers: updatedCustom,
                teamRoles: updatedRoles,
                teamTasks: updatedTasks
            });
            toast.showToast(`Removed team member ${username}`, "success");
        } catch (err) {
            toast.showToast("Failed to remove member", "error");
        }
    };

    // AI Milestone task generation
    const handleGenerateMilestones = async () => {
        if (!project) return;
        setAiGenerating(true);
        try {
            const token = localStorage.getItem("akasha_token") || localStorage.getItem("token") || "";
            const res = await fetch("/api/akasha/ai/generate-team-tasks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    projectName: project.name,
                    projectDescription: project.description || "",
                    ideaDetails: project.settings?.ideaDetails || null,
                    teamMembers: members
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to generate milestones");
            }

            const data = await res.json();
            if (data.tasks && Array.isArray(data.tasks)) {
                const existingTasks = project.settings?.teamTasks || [];
                const newTasks = data.tasks.map((t: any) => ({
                    ...t,
                    id: t.id || "ai-" + Math.random().toString(36).substr(2, 9)
                }));
                await updateProjectSettings({
                    teamTasks: [...existingTasks, ...newTasks]
                });
                toast.showToast(`Successfully generated ${newTasks.length} milestones!`, "success");
            } else {
                throw new Error("No tasks returned from AI model");
            }
        } catch (err: any) {
            toast.showToast(err.message || "Failed to generate milestones", "error");
        } finally {
            setAiGenerating(false);
        }
    };

    // Add manual task
    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        const title = newTaskTitle.trim();
        const description = newTaskDesc.trim();
        if (!title) return;

        const labels = newTaskLabels.split(",").map(s => s.trim()).filter(Boolean);
        const sp = parseInt(newTaskStoryPoints) || 0;

        const newTask: TeamTask = {
            id: "task-" + Date.now().toString(),
            title,
            description,
            assignedTo: newTaskAssignee,
            status: "todo",
            priority: newTaskPriority,
            dueDate: newTaskDueDate || undefined,
            labels: labels.length > 0 ? labels : undefined,
            storyPoints: sp > 0 ? sp : undefined,
            createdAt: new Date().toISOString()
        };

        try {
            const existingTasks = project?.settings?.teamTasks || [];
            await updateProjectSettings({
                teamTasks: [...existingTasks, newTask]
            });
            setNewTaskTitle("");
            setNewTaskDesc("");
            setNewTaskAssignee("All");
            setNewTaskPriority('medium');
            setNewTaskDueDate("");
            setNewTaskLabels("");
            setNewTaskStoryPoints("");
            setShowAddTask(false);
            toast.showToast("Task added successfully", "success");
        } catch (err) {
            toast.showToast("Failed to add task", "error");
        }
    };

    // Remove task
    const handleDeleteTask = async (taskId: string) => {
        try {
            const existingTasks = project?.settings?.teamTasks || [];
            const updatedTasks = existingTasks.filter((t: TeamTask) => t.id !== taskId);
            await updateProjectSettings({ teamTasks: updatedTasks });
            toast.showToast("Task deleted", "success");
        } catch (err) {
            toast.showToast("Failed to delete task", "error");
        }
    };

    // Open Edit Task Modal
    const openEditTask = (task: TeamTask) => {
        setEditingTask(task);
        setEditTaskTitle(task.title);
        setEditTaskDesc(task.description || "");
        setEditTaskAssignee(task.assignedTo);
        setEditTaskStatus(task.status);
        setEditTaskPriority(task.priority || 'medium');
        setEditTaskDueDate(task.dueDate || "");
        setEditTaskLabels((task.labels || []).join(", "));
        setEditTaskStoryPoints(task.storyPoints ? String(task.storyPoints) : "");
        setShowEditTask(true);
    };

    // Handle Edit Task Form Submit
    const handleEditTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;
        const title = editTaskTitle.trim();
        const description = editTaskDesc.trim();
        if (!title) return;

        const labels = editTaskLabels.split(",").map(s => s.trim()).filter(Boolean);
        const sp = parseInt(editTaskStoryPoints) || 0;

        try {
            const existingTasks = project?.settings?.teamTasks || [];
            const updatedTasks = existingTasks.map((t: TeamTask) =>
                t.id === editingTask.id
                    ? {
                        ...t, title, description,
                        assignedTo: editTaskAssignee,
                        status: editTaskStatus,
                        priority: editTaskPriority,
                        dueDate: editTaskDueDate || undefined,
                        labels: labels.length > 0 ? labels : undefined,
                        storyPoints: sp > 0 ? sp : undefined,
                    }
                    : t
            );
            await updateProjectSettings({ teamTasks: updatedTasks });
            setShowEditTask(false);
            setEditingTask(null);
            toast.showToast("Task updated successfully", "success");
        } catch (err) {
            toast.showToast("Failed to update task", "error");
        }
    };

    // Toggle Task status or checkbox (checking checkmark toggles status to "done" / "todo")
    const handleToggleTaskDone = async (taskId: string, currentStatus: string) => {
        const newStatus = currentStatus === "done" ? "todo" : "done";
        try {
            const existingTasks = project?.settings?.teamTasks || [];
            const updatedTasks = existingTasks.map((t: TeamTask) =>
                t.id === taskId ? { ...t, status: newStatus as any } : t
            );
            await updateProjectSettings({ teamTasks: updatedTasks });
        } catch (err) {
            toast.showToast("Failed to toggle task state", "error");
        }
    };

    // Move task state manually
    const handleMoveTask = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
        try {
            const existingTasks = project?.settings?.teamTasks || [];
            const updatedTasks = existingTasks.map((t: TeamTask) =>
                t.id === taskId ? { ...t, status: newStatus } : t
            );
            await updateProjectSettings({ teamTasks: updatedTasks });
        } catch (err) {
            toast.showToast("Failed to move task", "error");
        }
    };

    // Clear / Archive all completed tasks
    const handleClearCompleted = async () => {
        const completedTasks = tasks.filter((t: TeamTask) => t.status === "done");
        if (completedTasks.length === 0) return;

        if (window.confirm(`Are you sure you want to clear all ${completedTasks.length} completed tasks?`)) {
            try {
                const existingTasks = project?.settings?.teamTasks || [];
                const updatedTasks = existingTasks.filter((t: TeamTask) => t.status !== "done");
                await updateProjectSettings({ teamTasks: updatedTasks });
                toast.showToast(`Cleared ${completedTasks.length} completed tasks`, "success");
            } catch (err) {
                toast.showToast("Failed to clear completed tasks", "error");
            }
        }
    };

    // Drag & Drop event handlers
    const handleDragStart = (e: React.DragEvent, taskId: string) => {
        e.dataTransfer.setData("text/plain", taskId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDrop = async (e: React.DragEvent, newStatus: 'todo' | 'in_progress' | 'done') => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData("text/plain");
        if (taskId) {
            await handleMoveTask(taskId, newStatus);
        }
    };

    // Filter, search & sort tasks
    const tasks = project?.settings?.teamTasks || [];
    const searchedTasks = taskSearch.trim()
        ? tasks.filter((t: TeamTask) =>
            t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
            (t.description || "").toLowerCase().includes(taskSearch.toLowerCase()) ||
            (t.labels || []).some(l => l.toLowerCase().includes(taskSearch.toLowerCase())) ||
            t.assignedTo.toLowerCase().includes(taskSearch.toLowerCase())
          )
        : tasks;
    const filteredTasks = searchedTasks.filter((t: TeamTask) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "team") return t.assignedTo === "All";
        return t.assignedTo === activeFilter;
    });

    // Sort
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        const prioRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        if (taskSort === 'priority') return (prioRank[a.priority || 'medium'] || 2) - (prioRank[b.priority || 'medium'] || 2);
        if (taskSort === 'dueDate') {
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return a.dueDate.localeCompare(b.dueDate);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const todoTasks = sortedTasks.filter((t: TeamTask) => t.status === "todo");
    const inProgressTasks = sortedTasks.filter((t: TeamTask) => t.status === "in_progress");
    const doneTasks = sortedTasks.filter((t: TeamTask) => t.status === "done");

    // Task Completion Metrics
    const totalCount = tasks.length;
    const completedCount = tasks.filter((t: TeamTask) => t.status === "done").length;
    const inProgressCount = tasks.filter((t: TeamTask) => t.status === "in_progress").length;
    const todoCount = tasks.filter((t: TeamTask) => t.status === "todo").length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const soloMode = members.length === 0;

    // Per-member task stats
    const memberTaskStats = React.useMemo(() => {
        const stats: Record<string, { todo: number; in_progress: number; done: number; total: number; points: number }> = {};
        tasks.forEach((t: TeamTask) => {
            const assignee = t.assignedTo === 'All' ? 'All' : t.assignedTo;
            if (!stats[assignee]) stats[assignee] = { todo: 0, in_progress: 0, done: 0, total: 0, points: 0 };
            stats[assignee][t.status]++;
            stats[assignee].total++;
            stats[assignee].points += t.storyPoints || 0;
        });
        return stats;
    }, [tasks]);

    return (
        <div className="h-full w-full overflow-auto p-8 relative select-none">
            
            {/* AI Generator Spinner Overlay */}
            {aiGenerating && (
                <div className="fixed inset-0 bg-[#0f111a]/70 backdrop-blur-md z-[100] flex items-center justify-center">
                    <div className="bg-[#161822]/90 border border-indigo-500/20 p-8 rounded-2xl shadow-[0_0_50px_rgba(99,102,241,0.15)] flex flex-col items-center gap-4 max-w-sm text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
                        <h3 className="text-white text-lg font-black tracking-wide uppercase">Akasha AI</h3>
                        <p className="text-white/40 text-xs leading-relaxed">
                            {soloMode ? "Generating project milestones and roadmap tasks..." : "Analyzing project features and generating milestone tasks for team members..."}
                        </p>
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto space-y-8 pb-16">
                
                {/* ━━ PAGE HEADER ━━ */}
                <div className="flex items-center justify-between">
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${soloMode ? "text-emerald-400" : "text-indigo-400"}`}>
                            {soloMode ? "Planning" : "Workspace"}
                        </span>
                        <h1 className="text-2xl font-black text-white tracking-tight mt-1">
                            {soloMode ? "Roadmap & Tasks" : "Team Space"}
                        </h1>
                        <p className="text-xs text-white/30 mt-1">
                            {soloMode ? "Plan your project milestones and track your progress." : "Manage team roles and track project milestone deliverables."}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleGenerateMilestones}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] border ${soloMode ? "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-[0_4px_20px_rgba(16,185,129,0.25)] border-emerald-400/20" : "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-[0_4px_20px_rgba(99,102,241,0.25)] border-indigo-400/20"}`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            Generate Milestones
                        </button>
                        <button
                            onClick={() => setShowAddTask(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-[1.02]"
                        >
                            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                            </svg>
                            Add Task
                        </button>
                    </div>
                </div>

                {/* ━━ METRICS & COMPLETION PROGRESS ━━ */}
                {totalCount > 0 && (
                    <div className={`relative overflow-hidden rounded-2xl p-6 backdrop-blur-xl border ${soloMode ? "bg-[#0f1a14]/60 border-emerald-500/10" : "bg-[#11131c]/60 border-white/5"}`}>
                        <div className={`absolute top-0 left-0 h-[2px] transition-all duration-500 ${soloMode ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" : "bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"}`} style={{ width: `${completionRate}%` }} />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-white tabular-nums">{completionRate}%</span>
                                    <span className="text-xs text-white/45 uppercase font-black tracking-wider">
                                        {soloMode ? "Complete" : "Milestones Completed"}
                                    </span>
                                </div>
                                <div className="text-[10px] text-white/30">
                                    {soloMode
                                        ? `${totalCount} task${totalCount !== 1 ? "s" : ""} planned · ${completedCount} done`
                                        : `Track project delivery status across ${members.length} team members.`
                                    }
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6 sm:gap-12">
                                <div className="text-center sm:text-left">
                                    <div className={`text-sm font-black tabular-nums ${soloMode ? "text-emerald-400" : "text-indigo-400"}`}>{todoCount}</div>
                                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">To Do</div>
                                </div>
                                <div className="text-center sm:text-left">
                                    <div className="text-sm font-black text-amber-400 tabular-nums">{inProgressCount}</div>
                                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">In Progress</div>
                                </div>
                                <div className="text-center sm:text-left">
                                    <div className="text-sm font-black text-emerald-400 tabular-nums">{completedCount}</div>
                                    <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5">Completed</div>
                                </div>
                            </div>
                        </div>
                        <div className="w-full bg-[#0f111a] h-1.5 rounded-full mt-4 overflow-hidden border border-white/5">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ease-out ${soloMode ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" : "bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"}`}
                                style={{ width: `${completionRate}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* ━━ SOLO MODE: ROADMAP ━━ */}
                {soloMode && (
                    <div className="bg-[#0f1a14]/60 border border-emerald-500/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                        
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Project Roadmap</h2>
                                <p className="text-[10px] text-white/30 mt-0.5">
                                    Milestones and tasks for your project journey.
                                </p>
                            </div>
                        </div>

                        {/* Timeline */}
                        {totalCount === 0 ? (
                            <div className="py-12 flex flex-col items-center gap-3 text-center">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                    </svg>
                                </div>
                                <p className="text-sm text-white/40 font-semibold">No milestones yet</p>
                                <p className="text-[11px] text-white/20 max-w-xs">Generate milestones with AI or add your first task to build your project roadmap.</p>
                            </div>
                        ) : (
                            <div className="relative">
                                {/* Vertical timeline line */}
                                <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-emerald-500/20" />
                                
                                {/* Phase: To Do */}
                                {todoTasks.length > 0 && (
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-6 h-6 rounded-full bg-indigo-500/20 border-2 border-indigo-500 flex items-center justify-center flex-shrink-0 z-10 relative">
                                                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                            </div>
                                            <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wider">Upcoming</h3>
                                            <span className="text-[10px] font-bold text-white/30 tabular-nums">{todoTasks.length} task{todoTasks.length !== 1 ? "s" : ""}</span>
                                        </div>
                                        <div className="space-y-2 ml-10">
                                            {todoTasks.map((task: TeamTask) => (
                                                <RoadmapCard key={task.id} task={task} accent="indigo"
                                                    onToggleDone={() => handleToggleTaskDone(task.id, task.status)}
                                                    onEdit={() => openEditTask(task)}
                                                    onDelete={() => handleDeleteTask(task.id)}
                                                    onMove={(s) => handleMoveTask(task.id, s)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Phase: In Progress */}
                                {inProgressTasks.length > 0 && (
                                    <div className="mb-8">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-6 h-6 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center flex-shrink-0 z-10 relative">
                                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                                            </div>
                                            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">In Progress</h3>
                                            <span className="text-[10px] font-bold text-white/30 tabular-nums">{inProgressTasks.length} task{inProgressTasks.length !== 1 ? "s" : ""}</span>
                                        </div>
                                        <div className="space-y-2 ml-10">
                                            {inProgressTasks.map((task: TeamTask) => (
                                                <RoadmapCard key={task.id} task={task} accent="amber"
                                                    onToggleDone={() => handleToggleTaskDone(task.id, task.status)}
                                                    onEdit={() => openEditTask(task)}
                                                    onDelete={() => handleDeleteTask(task.id)}
                                                    onMove={(s) => handleMoveTask(task.id, s)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Phase: Done */}
                                {doneTasks.length > 0 && (
                                    <div>
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center flex-shrink-0 z-10 relative">
                                                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">Completed</h3>
                                            <span className="text-[10px] font-bold text-white/30 tabular-nums">{doneTasks.length} task{doneTasks.length !== 1 ? "s" : ""}</span>
                                        </div>
                                        <div className="space-y-2 ml-10">
                                            {doneTasks.map((task: TeamTask) => (
                                                <RoadmapCard key={task.id} task={task} accent="emerald"
                                                    onToggleDone={() => handleToggleTaskDone(task.id, task.status)}
                                                    onEdit={() => openEditTask(task)}
                                                    onDelete={() => handleDeleteTask(task.id)}
                                                    onMove={(s) => handleMoveTask(task.id, s)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ━━ TEAM MODE: TEAM MEMBERS ━━ */}
                {!soloMode && (
                <div className="bg-[#11131c]/60 border border-white/5 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full" />
                    
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xs font-black text-indigo-400 uppercase tracking-widest">Team Members</h2>
                            <p className="text-[10px] text-white/30 mt-0.5">
                                {orgName
                                    ? `Auto-detected from organization "${orgName}". Roles sync from user profiles.`
                                    : "Assign specialized development roles to each member."
                                }
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {orgMembers.length > 0 && (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                    Org Synced
                                </span>
                            )}
                            <button
                                onClick={() => setShowAddMember(true)}
                                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-white border border-white/5 rounded-lg text-[10px] font-black uppercase transition-all"
                            >
                                + Add Member
                            </button>
                        </div>
                    </div>

                    {/* Members grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {members.length === 0 ? (
                            <div className="col-span-full py-4 text-xs text-white/30 italic text-center">
                                No team members found. Click "+ Add Member" to add someone.
                            </div>
                        ) : (
                            members.map((m) => {
                                const stats = memberTaskStats[m.username];
                                return (
                                <div key={m.username} className="bg-[#161822]/80 border border-white/5 rounded-xl p-4 flex flex-col justify-between group relative hover:border-indigo-500/20 transition-all">
                                {!orgMembers.some(o => o.username.toLowerCase() === m.username.toLowerCase()) && dbMembers.length === 0 && m.username !== "You" && (
                                    <button
                                        onClick={() => handleRemoveMember(m.username)}
                                        className="absolute top-3 right-3 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Remove Member"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center font-black text-sm ${getMemberAvatarStyle(m.username)}`}>
                                        {getInitials(m.username)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-sm font-bold text-white truncate">{m.displayName || m.username}</div>
                                        <div className="text-[10px] text-indigo-400/80 font-semibold">{m.role}</div>
                                    </div>
                                    {/* Per-member task stats */}
                                    {stats && (
                                        <div className="flex items-center gap-3 text-[9px] font-bold font-mono">
                                            <span className="text-indigo-400">{stats.todo}</span>
                                            <span className="text-amber-400">{stats.in_progress}</span>
                                            <span className="text-emerald-400">{stats.done}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="relative mb-2">
                                    <select
                                        value={m.role}
                                        onChange={(e) => handleUpdateRole(m.username, e.target.value)}
                                        className="w-full bg-[#0f111a] border border-white/5 text-[11px] rounded-lg px-2.5 py-1.5 text-white/50 hover:text-white focus:outline-none focus:border-indigo-500/40 cursor-pointer font-medium transition-all"
                                    >
                                        {ROLE_OPTIONS.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* Mini stats bar */}
                                {stats && (
                                    <div className="flex items-center gap-2 text-[8px] text-white/30 font-bold uppercase tracking-wider">
                                        <span>{stats.total} tasks</span>
                                        {stats.points > 0 && (
                                            <span className="text-white/40">{stats.points} pts</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    }))}
                    </div>
                </div>
                )}

                {/* ━━ KANBAN BOARD ━━ */}
                <div>
                    {/* Filters rail */}
                    <div className={`flex items-center justify-between border-b pb-4 mb-6 ${soloMode ? "border-emerald-500/10" : "border-white/5"}`}>
                        <div className="flex gap-2 overflow-x-auto">
                            {soloMode ? (
                                <div className="flex items-center gap-2 px-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span className="text-xs font-black text-white uppercase tracking-wider">Tasks</span>
                                    <span className="text-[10px] font-bold text-white/30 tabular-nums">({filteredTasks.length})</span>
                                </div>
                            ) : (
                                <>
                            <button
                                onClick={() => setActiveFilter("all")}
                                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeFilter === "all" ? "bg-indigo-500 text-white shadow-[0_4px_15px_rgba(99,102,241,0.2)]" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"}`}
                            >
                                All Team Tasks
                            </button>
                            <button
                                onClick={() => setActiveFilter("team")}
                                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeFilter === "team" ? "bg-indigo-500 text-white shadow-[0_4px_15px_rgba(99,102,241,0.2)]" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"}`}
                            >
                                Shared Milestones (All)
                            </button>
                            <div className="w-[1px] h-5 bg-white/10 self-center mx-1" />
                            {members.map(m => (
                                <button
                                    key={m.username}
                                    onClick={() => setActiveFilter(m.username)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all ${activeFilter === m.username ? "bg-indigo-500 text-white shadow-[0_4px_15px_rgba(99,102,241,0.2)]" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"}`}
                                >
                                    {m.username}
                                </button>
                            ))}
                            </>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Search */}
                            <div className="relative">
                                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    value={taskSearch}
                                    onChange={e => setTaskSearch(e.target.value)}
                                    placeholder="Search tasks..."
                                    className="w-36 lg:w-44 bg-[#0f111a] border border-white/5 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-white/70 placeholder-white/20 focus:outline-none focus:border-indigo-500/40 transition-all"
                                />
                            </div>
                            {/* Sort */}
                            <select
                                value={taskSort}
                                onChange={e => setTaskSort(e.target.value as any)}
                                className="bg-[#0f111a] border border-white/5 text-[10px] rounded-lg px-2.5 py-1.5 text-white/50 hover:text-white focus:outline-none focus:border-indigo-500/40 cursor-pointer font-medium uppercase tracking-wider transition-all"
                            >
                                <option value="created">Newest</option>
                                <option value="priority">Priority</option>
                                <option value="dueDate">Due Date</option>
                            </select>
                            <span className="text-[10px] text-white/30 font-semibold uppercase tracking-wider tabular-nums whitespace-nowrap">
                                {filteredTasks.length}/{tasks.length}
                            </span>
                        </div>
                    </div>

                    {/* Columns grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* COLUMN: TO DO */}
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setDraggedOverColumn('todo'); }}
                            onDragLeave={() => setDraggedOverColumn(null)}
                            onDrop={(e) => { handleDrop(e, 'todo'); setDraggedOverColumn(null); }}
                            className={`flex flex-col h-[550px] border rounded-2xl p-4 backdrop-blur-md transition-all duration-300 ${draggedOverColumn === 'todo' ? "bg-indigo-500/5 border-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.05)]" : "bg-[#11131c]/40 border-white/5"}`}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${soloMode ? "bg-emerald-500" : "bg-indigo-500"}`} />
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">To Do</h3>
                                </div>
                                <span className="text-[10px] font-black bg-white/5 text-white/40 px-2 py-0.5 rounded-full tabular-nums">{todoTasks.length}</span>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {todoTasks.length === 0 ? (
                                    <div className="h-28 border border-dashed border-white/5 rounded-xl flex items-center justify-center text-xs text-white/20 italic">No tasks in To Do</div>
                                ) : (
                                    todoTasks.map((task: TeamTask) => (
                                        <KanbanCard
                                            key={task.id}
                                            task={task}
                                            solo={soloMode}
                                            onToggleDone={() => handleToggleTaskDone(task.id, task.status)}
                                            onMove={(status) => handleMoveTask(task.id, status)}
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onEdit={() => openEditTask(task)}
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* COLUMN: IN PROGRESS */}
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setDraggedOverColumn('in_progress'); }}
                            onDragLeave={() => setDraggedOverColumn(null)}
                            onDrop={(e) => { handleDrop(e, 'in_progress'); setDraggedOverColumn(null); }}
                            className={`flex flex-col h-[550px] border rounded-2xl p-4 backdrop-blur-md transition-all duration-300 ${draggedOverColumn === 'in_progress' ? "bg-amber-500/5 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.05)]" : "bg-[#11131c]/40 border-white/5"}`}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">In Progress</h3>
                                </div>
                                <span className="text-[10px] font-black bg-white/5 text-white/40 px-2 py-0.5 rounded-full tabular-nums">{inProgressTasks.length}</span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {inProgressTasks.length === 0 ? (
                                    <div className="h-28 border border-dashed border-white/5 rounded-xl flex items-center justify-center text-xs text-white/20 italic">No tasks in progress</div>
                                ) : (
                                    inProgressTasks.map((task: TeamTask) => (
                                        <KanbanCard
                                            key={task.id}
                                            task={task}
                                            solo={soloMode}
                                            onToggleDone={() => handleToggleTaskDone(task.id, task.status)}
                                            onMove={(status) => handleMoveTask(task.id, status)}
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onEdit={() => openEditTask(task)}
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                        {/* COLUMN: COMPLETED */}
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setDraggedOverColumn('done'); }}
                            onDragLeave={() => setDraggedOverColumn(null)}
                            onDrop={(e) => { handleDrop(e, 'done'); setDraggedOverColumn(null); }}
                            className={`flex flex-col h-[550px] border rounded-2xl p-4 backdrop-blur-md transition-all duration-300 ${draggedOverColumn === 'done' ? "bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]" : "bg-[#11131c]/40 border-white/5"}`}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4 flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${soloMode ? "bg-emerald-500" : "bg-emerald-500"}`} />
                                    <h3 className="text-xs font-black text-white uppercase tracking-wider">Completed</h3>
                                </div>
                                <div className="flex items-center gap-2">
                                    {doneTasks.length > 0 && (
                                        <button
                                            onClick={handleClearCompleted}
                                            className="text-[9px] font-black text-white/40 hover:text-red-400 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded transition-all"
                                            title="Clear Completed Tasks"
                                        >
                                            Clear
                                        </button>
                                    )}
                                    <span className="text-[10px] font-black bg-white/5 text-white/40 px-2 py-0.5 rounded-full tabular-nums">{doneTasks.length}</span>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                {doneTasks.length === 0 ? (
                                    <div className="h-28 border border-dashed border-white/5 rounded-xl flex items-center justify-center text-xs text-white/20 italic">No completed tasks</div>
                                ) : (
                                    doneTasks.map((task: TeamTask) => (
                                        <KanbanCard
                                            key={task.id}
                                            task={task}
                                            solo={soloMode}
                                            onToggleDone={() => handleToggleTaskDone(task.id, task.status)}
                                            onMove={(status) => handleMoveTask(task.id, status)}
                                            onDelete={() => handleDeleteTask(task.id)}
                                            onEdit={() => openEditTask(task)}
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                        />
                                    ))
                                )}
                            </div>
                        </div>

                    </div>
                </div>

            </div>

            {/* MODAL: ADD CUSTOM MEMBER */}
            {showAddMember && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <form onSubmit={handleAddMember} className="bg-[#161822] border border-white/5 p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Add Team Member</h3>
                            <button type="button" onClick={() => setShowAddMember(false)} className="text-white/40 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 uppercase">Username / Nickname</label>
                            <input
                                type="text"
                                required
                                value={newMemberName}
                                onChange={(e) => setNewMemberName(e.target.value)}
                                className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                placeholder="e.g. Alice"
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase transition-all"
                        >
                            Add Member
                        </button>
                    </form>
                </div>
            )}

            {/* MODAL: ADD MANUAL TASK */}
            {showAddTask && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
                    <form onSubmit={handleAddTask} className="bg-[#161822] border border-white/5 p-6 rounded-2xl max-w-md w-full space-y-4 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Add Milestone Task</h3>
                            <button type="button" onClick={() => setShowAddTask(false)} className="text-white/40 hover:text-white">✕</button>
                        </div>
                        
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 uppercase">Task Title</label>
                            <input
                                type="text"
                                required
                                value={newTaskTitle}
                                onChange={(e) => setNewTaskTitle(e.target.value)}
                                className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                placeholder="e.g. Design Landing Page Visual Mockups"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 uppercase">Description</label>
                            <textarea
                                value={newTaskDesc}
                                onChange={(e) => setNewTaskDesc(e.target.value)}
                                rows={3}
                                className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
                                placeholder="Provide brief summary of task requirements..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-white/40 uppercase">Assignee</label>
                            <select
                                value={newTaskAssignee}
                                onChange={(e) => setNewTaskAssignee(e.target.value)}
                                className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                            >
                                <option value="All">All (Whole Team)</option>
                                {members.map(m => (
                                    <option key={m.username} value={m.username}>{m.username} ({m.role})</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase">Priority</label>
                                <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value as any)} className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer">
                                    <option value="critical">Critical</option>
                                    <option value="high">High</option>
                                    <option value="medium">Medium</option>
                                    <option value="low">Low</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase">Due Date</label>
                                <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase">Labels (comma-separated)</label>
                                <input type="text" value={newTaskLabels} onChange={e => setNewTaskLabels(e.target.value)} className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="feature, bug, design" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-white/40 uppercase">Story Points</label>
                                <input type="number" min="0" value={newTaskStoryPoints} onChange={e => setNewTaskStoryPoints(e.target.value)} className="w-full bg-[#0f111a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. 3" />
                            </div>
                        </div>

                        <button type="submit" className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase transition-all">Create Task</button>
                    </form>
                </div>
            )}

            {/* MODAL: EDIT MILESTONE TASK */}
            {showEditTask && editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { setShowEditTask(false); setEditingTask(null); }}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
                    <div className="relative w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className={`absolute -inset-1 rounded-2xl blur-xl opacity-30 ${soloMode ? "bg-emerald-500" : "bg-indigo-500"}`} />
                        <form onSubmit={handleEditTask} className={`relative bg-[#1a1d2e] border ${soloMode ? "border-emerald-500/20" : "border-indigo-500/20"} rounded-2xl shadow-2xl overflow-hidden`}>
                            {/* Top gradient bar */}
                            <div className={`h-1 w-full ${soloMode ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" : "bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"}`} />
                            
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 pt-5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${soloMode ? "bg-emerald-500/15 text-emerald-400" : "bg-indigo-500/15 text-indigo-400"}`}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white tracking-wide">Edit Milestone Task</h3>
                                        <p className="text-[10px] text-white/35 mt-0.5">Update details for this task</p>
                                    </div>
                                </div>
                                <button type="button" onClick={() => { setShowEditTask(false); setEditingTask(null); }} className={`w-7 h-7 rounded-lg flex items-center justify-center ${soloMode ? "hover:bg-emerald-500/10 hover:text-emerald-400" : "hover:bg-indigo-500/10 hover:text-indigo-400"} text-white/40 transition-all`}>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="px-6 pb-6 space-y-4">
                                {/* Task Title */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Task Title</label>
                                    <input type="text" required value={editTaskTitle} onChange={(e) => setEditTaskTitle(e.target.value)}
                                        className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all`}
                                        placeholder="e.g. Design Landing Page Visual Mockups"
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Description</label>
                                    <textarea value={editTaskDesc} onChange={(e) => setEditTaskDesc(e.target.value)} rows={3}
                                        className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none resize-none transition-all`}
                                        placeholder="Provide brief summary of task requirements..."
                                    />
                                </div>

                                {/* Assignee + Status row */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Assignee</label>
                                        <select value={editTaskAssignee} onChange={(e) => setEditTaskAssignee(e.target.value)}
                                            className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none cursor-pointer transition-all`}>
                                            <option value="All">All (Whole Team)</option>
                                            {members.map(m => (
                                                <option key={m.username} value={m.username}>{m.displayName || m.username} ({m.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Status</label>
                                        <select value={editTaskStatus} onChange={e => setEditTaskStatus(e.target.value as any)}
                                            className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none cursor-pointer transition-all`}>
                                            <option value="todo">To Do</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="done">Completed</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Priority + Due Date */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Priority</label>
                                        <select value={editTaskPriority} onChange={e => setEditTaskPriority(e.target.value as any)}
                                            className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none cursor-pointer transition-all`}>
                                            <option value="critical">Critical</option>
                                            <option value="high">High</option>
                                            <option value="medium">Medium</option>
                                            <option value="low">Low</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Due Date</label>
                                        <input type="date" value={editTaskDueDate} onChange={e => setEditTaskDueDate(e.target.value)}
                                            className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all`} />
                                    </div>
                                </div>

                                {/* Labels + Story Points */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Labels</label>
                                        <input type="text" value={editTaskLabels} onChange={e => setEditTaskLabels(e.target.value)}
                                            className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all`}
                                            placeholder="feature, bug, design" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Story Points</label>
                                        <input type="number" min="0" value={editTaskStoryPoints} onChange={e => setEditTaskStoryPoints(e.target.value)}
                                            className={`w-full bg-[#0f111a] border ${soloMode ? "border-emerald-500/10 focus:border-emerald-500/50" : "border-white/5 focus:border-indigo-500/50"} rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition-all`}
                                            placeholder="e.g. 3" />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => { handleDeleteTask(editingTask.id); setShowEditTask(false); setEditingTask(null); }}
                                        className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-95">
                                        Delete
                                    </button>
                                    <button type="submit"
                                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all hover:scale-[1.02] active:scale-95 ${soloMode ? "bg-emerald-500 hover:bg-emerald-600" : "bg-indigo-500 hover:bg-indigo-600"}`}>
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

/* KANBAN CARD SUB-COMPONENT */
interface KanbanCardProps {
    task: TeamTask;
    solo?: boolean;
    onToggleDone: () => void;
    onMove: (status: 'todo' | 'in_progress' | 'done') => void;
    onDelete: () => void;
    onEdit: () => void;
    onDragStart: (e: React.DragEvent) => void;
}

function KanbanCard({ task, solo, onToggleDone, onMove, onDelete, onEdit, onDragStart }: KanbanCardProps) {
    const isDone = task.status === "done";
    const pc = PRIORITY_CONFIG[task.priority || 'medium'];
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

    return (
        <div 
            draggable
            onDragStart={onDragStart}
            onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button') || target.closest('select') || target.closest('input')) return;
                onEdit();
            }}
            className={`p-4 rounded-xl border bg-[#161822]/90 flex flex-col justify-between gap-3 group relative cursor-grab active:cursor-grabbing transition-all duration-300 hover:scale-[1.01] ${isDone ? "border-emerald-500/10 opacity-60 hover:opacity-100" : "border-white/5"} ${solo ? "hover:border-emerald-500/30" : "hover:border-indigo-500/30"}`}
        >
            {/* Priority stripe */}
            <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl ${pc?.bg || "bg-white/5"}`} />

            {/* Action buttons */}
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className={`p-1 hover:bg-white/5 text-white/20 rounded transition-colors ${solo ? "hover:text-emerald-400" : "hover:text-indigo-400"}`} title="Edit Task">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-white/5 text-white/20 hover:text-red-400 rounded transition-colors" title="Delete Task">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>

            {/* Checkbox + Title/Desc */}
            <div className="flex items-start gap-3 pr-10">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : `border-white/20 ${solo ? "hover:border-emerald-400/60" : "hover:border-indigo-400/60"}`}`}
                >
                    {isDone && (
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>
                <div className="min-w-0 flex-1">
                    <h4 className={`text-xs font-bold text-white tracking-wide ${isDone ? "line-through text-white/40" : ""}`}>{task.title}</h4>
                    {task.description && (
                        <p className={`text-[10px] text-white/35 leading-normal mt-1.5 line-clamp-2 ${isDone ? "line-through text-white/25" : ""}`}>{task.description}</p>
                    )}
                    {/* Priority badge + Labels row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {pc && (
                            <span className={`inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${pc.bg} ${pc.text} ${pc.border} border`}>
                                {pc.label}
                            </span>
                        )}
                        {(task.labels || []).slice(0, 3).map(label => (
                            <span key={label} className="inline-block text-[8px] font-medium text-white/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                {label}
                            </span>
                        ))}
                        {(task.labels || []).length > 3 && (
                            <span className="text-[8px] text-white/20">+{task.labels!.length - 3}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom row: assignee + meta + move controls */}
            <div className="flex items-center justify-between border-t border-white/5 pt-3">
                <div className="flex items-center gap-2">
                    {!solo && (
                    <>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[9px] border ${getMemberAvatarStyle(task.assignedTo)}`}>
                        {getInitials(task.assignedTo)}
                    </div>
                    <span className="text-[9px] font-bold text-white/50 group-hover:text-white/80 transition-colors truncate max-w-[80px]">
                        {task.assignedTo === 'All' ? 'Whole Team' : task.assignedTo}
                    </span>
                    </>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {/* Due date */}
                    {task.dueDate && (
                        <span className={`text-[8px] font-bold font-mono ${isOverdue ? "text-red-400" : "text-white/30"}`}>
                            {isOverdue ? "OVERDUE " : ""}{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                    )}
                    {/* Story points */}
                    {task.storyPoints && (
                        <span className="text-[8px] font-bold text-white/20 bg-white/5 px-1.5 py-0.5 rounded font-mono">{task.storyPoints}pt</span>
                    )}
                    {/* Movement arrows */}
                    <div className="flex items-center gap-1 ml-1">
                        {task.status !== "todo" && (
                            <button onClick={(e) => { e.stopPropagation(); onMove(task.status === "done" ? "in_progress" : "todo"); }} className="p-1 hover:bg-white/5 text-white/30 hover:text-white rounded transition-colors" title="Move back">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        )}
                        {task.status !== "done" && (
                            <button onClick={(e) => { e.stopPropagation(); onMove(task.status === "todo" ? "in_progress" : "done"); }} className="p-1 hover:bg-white/5 text-white/30 hover:text-white rounded transition-colors" title="Move forward">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ROADMAP CARD SUB-COMPONENT (Solo Mode Timeline) */
interface RoadmapCardProps {
    task: TeamTask;
    accent: 'indigo' | 'amber' | 'emerald';
    onToggleDone: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onMove: (status: 'todo' | 'in_progress' | 'done') => void;
}

function RoadmapCard({ task, accent, onToggleDone, onEdit, onDelete, onMove }: RoadmapCardProps) {
    const pc = PRIORITY_CONFIG[task.priority || 'medium'];
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";
    const borderColor = accent === 'emerald' ? 'border-emerald-500/20 hover:border-emerald-500/40'
        : accent === 'amber' ? 'border-amber-500/20 hover:border-amber-500/40'
        : 'border-indigo-500/20 hover:border-indigo-500/40';

    return (
        <div
            onClick={() => onEdit()}
            className={`bg-[#161822]/80 border ${borderColor} rounded-xl p-3.5 flex items-start gap-3 transition-all hover:bg-[#161822] cursor-pointer group`}
        >
            <button
                onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${task.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-white/20 hover:border-emerald-400/60"}`}
            >
                {task.status === "done" && (
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </button>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className={`text-sm font-bold text-white ${task.status === "done" ? "line-through text-white/40" : ""}`}>{task.title}</h4>
                    {pc && (
                        <span className={`text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${pc.bg} ${pc.text} border`}>{pc.label}</span>
                    )}
                    {task.storyPoints && (
                        <span className="text-[8px] font-mono font-bold text-white/20">({task.storyPoints}pt)</span>
                    )}
                </div>
                {task.description && (
                    <p className={`text-[10px] text-white/30 leading-relaxed mt-1 line-clamp-2 ${task.status === "done" ? "line-through text-white/20" : ""}`}>{task.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                    {(task.labels || []).slice(0, 3).map(label => (
                        <span key={label} className="text-[8px] font-medium text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{label}</span>
                    ))}
                    {task.dueDate && (
                        <span className={`text-[8px] font-bold font-mono ${isOverdue ? "text-red-400" : "text-white/25"}`}>
                            {isOverdue ? "OVERDUE " : ""}{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {task.status !== "todo" && (
                    <button onClick={(e) => { e.stopPropagation(); onMove(task.status === "done" ? "in_progress" : "todo"); }} className="p-1 hover:bg-white/10 text-white/30 hover:text-white rounded transition-colors" title="Move back">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
                {task.status !== "done" && (
                    <button onClick={(e) => { e.stopPropagation(); onMove(task.status === "todo" ? "in_progress" : "done"); }} className="p-1 hover:bg-white/10 text-white/30 hover:text-white rounded transition-colors" title="Move forward">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-white/10 text-white/20 hover:text-red-400 rounded transition-colors" title="Delete">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
