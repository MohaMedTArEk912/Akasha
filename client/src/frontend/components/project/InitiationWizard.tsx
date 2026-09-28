import React, { useEffect, useState } from "react";
import { useSocket } from "../../hooks/useSocket";
import { httpApi } from "../../hooks/useHttpApi";
import { setProject, setActivePage } from "../../stores/projectStore";
import { useToast } from "../../context/ToastContext";
import useApi from "../../hooks/useApi";

interface InitiationWizardProps {
  project: any;
  projectId: string;
}

type WizardPhase = "questions" | "analyzing" | "deciding" | "generating" | "complete";

export default function InitiationWizard({ project, projectId }: InitiationWizardProps) {
  const toast = useToast();
  const api = useApi();
  const [role, setRole] = useState<"leader" | "member">("member");
  const [localAnswer, setLocalAnswer] = useState("");
  const [commentText, setCommentText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [, setIsGenerating] = useState(false);

  // Rebuild state
  const [wizardPhase, setWizardPhase] = useState<WizardPhase>("questions");
  const [, setAnalysisResult] = useState<any>(null);
  const [featureQueue, setFeatureQueue] = useState<any[]>([]);
  const [currentFeatureIdx, setCurrentFeatureIdx] = useState(0);
  const [featureDecisions, setFeatureDecisions] = useState<
    { id: string; title: string; description: string; status: "approved" | "rejected"; comment: string }[]
  >([]);
  const [featureComment, setFeatureComment] = useState("");
  const [generatedDoc, setGeneratedDoc] = useState<any>(null);

  // 1. Fetch user's role on mount/project change
  useEffect(() => {
    if (projectId) {
      httpApi
        .getProjectRole(projectId)
        .then((res: any) => {
          if (res && res.role) {
            setRole(res.role);
          }
        })
        .catch((err) => {
          console.error("Error fetching project role:", err);
        });
    }
  }, [projectId]);

  // 2. Setup Socket.io real-time syncing
  const token = localStorage.getItem("akasha_token") || "";
  const socket = useSocket(token);

  useEffect(() => {
    if (socket && projectId) {
      socket.emit("join:project", projectId);

      const handleProjectUpdated = (updatedProj: any) => {
        setProject(updatedProj);
        // If settings has ideaDetails populated (e.g. by another leader), go straight to complete
        if (updatedProj.settings?.ideaDetails && wizardPhase !== "complete") {
          setGeneratedDoc(updatedProj.settings.ideaDetails);
          setWizardPhase("complete");
        }
      };

      socket.on("project:updated", handleProjectUpdated);

      return () => {
        socket.emit("leave:project", projectId);
        socket.off("project:updated", handleProjectUpdated);
      };
    }
  }, [socket, projectId, wizardPhase]);

  // Sync with project state on load/update
  useEffect(() => {
    if (project?.settings?.ideaDetails) {
      setGeneratedDoc(project.settings.ideaDetails);
      setWizardPhase("complete");
    }
  }, [project]);

  // 3. Question tracking
  const questions = project.pipelineData?.questions || [];
  const currentStep = project.checkpoint || 1;
  const currentQuestion =
    questions.find((q: any) => q.id === currentStep) ||
    questions[0] ||
    { id: 1, question: "Question", answer: "", comments: [] };

  // Sync text area when step/question updates from server
  useEffect(() => {
    setLocalAnswer(currentQuestion.answer || "");
  }, [currentQuestion.id, currentQuestion.answer]);

  const hasOrg = !!project.orgId;
  const isLeader = role === "leader" || !hasOrg;

  // 4. Save/Progress functions
  const handleProgress = async (nextStep: number, isFinalize = false) => {
    setIsSaving(true);
    const updatedQuestions = questions.map((q: any) => {
      if (q.id === currentQuestion.id) {
        return { ...q, answer: localAnswer };
      }
      return q;
    });

    const updatedPipelineData = {
      ...project.pipelineData,
      questions: updatedQuestions,
    };

    try {
      if (isFinalize) {
        setIsGenerating(true);
        // 1. Persist final answers but KEEP status as "initializing" so the wizard stays mounted
        const updatedProj = await httpApi.updateCheckpoint(
          projectId,
          5,
          updatedPipelineData,
          "initializing"
        );
        setProject(updatedProj);

        // 2. Build description from Q&A
        const desc = updatedQuestions
          .map((q: any) => `### ${q.question}\n${q.answer || "(no answer)"}`)
          .join("\n\n");
        await api.updateProjectDescription(desc, projectId);

        setIsGenerating(false);
        setWizardPhase("analyzing");
        runAnalysis(desc);
      } else {
        // Normal step progression
        const updatedProj = await httpApi.updateCheckpoint(
          projectId,
          nextStep,
          updatedPipelineData,
          "initializing"
        );
        setProject(updatedProj);
        toast.showToast("Step progress saved successfully", "success");
      }
    } catch (err: any) {
      toast.showToast(err.message || "Failed to update project checkpoint", "error");
      setIsGenerating(false);
    } finally {
      setIsSaving(false);
    }
  };

  const runAnalysis = async (desc: string) => {
    try {
      const result = await httpApi.analyzeIdea(desc);
      setAnalysisResult(result);

      // Build feature queue from AISuggestions or feature_queue
      const features = result.feature_queue || (result.suggestions || []).slice(0, 8).map((title: string, index: number) => ({
        id: `feat-${index}`,
        title,
        description: "",
        rationale: "",
      }));
      
      setFeatureQueue(features);
      setWizardPhase("deciding");
    } catch (e: any) {
      toast.showToast(e.message || "Analysis failed", "error");
      setWizardPhase("questions");
    }
  };

  const handleFeatureDecision = (status: "approved" | "rejected") => {
    const feat = featureQueue[currentFeatureIdx];
    setFeatureDecisions((d) => [
      ...d,
      {
        id: feat.id || `feat-${currentFeatureIdx}`,
        title: feat.title,
        description: feat.description || feat.rationale || "",
        status,
        comment: featureComment,
      },
    ]);
    setFeatureComment("");

    if (currentFeatureIdx + 1 >= featureQueue.length) {
      setWizardPhase("generating");
      runGeneration();
    } else {
      setCurrentFeatureIdx((i) => i + 1);
    }
  };

  const handleBackFeature = () => {
    if (currentFeatureIdx > 0) {
      setCurrentFeatureIdx((i) => i - 1);
      setFeatureDecisions((d) => d.slice(0, -1));
    }
  };

  const runGeneration = async () => {
    try {
      // Generate structured idea Details
      const updatedProj = await httpApi.generateStructuredIdea(projectId);
      setProject(updatedProj);
      setGeneratedDoc(updatedProj.settings?.ideaDetails);
      setWizardPhase("complete");
    } catch (e: any) {
      toast.showToast(e.message || "Structured plan generation failed", "error");
      setWizardPhase("deciding");
    }
  };

  const handleEnterIDE = async () => {
    setIsSaving(true);
    try {
      // Finally change status to initiated to close the wizard and enter the workspace
      const updatedProj = await httpApi.updateCheckpoint(
        projectId,
        5,
        project.pipelineData,
        "initiated"
      );
      setProject(updatedProj);
      setActivePage("dashboard");
    } catch (err: any) {
      toast.showToast(err.message || "Failed to finalize project initiation", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    const updatedQuestions = questions.map((q: any) => {
      if (q.id === currentQuestion.id) {
        return { ...q, answer: localAnswer };
      }
      return q;
    });

    const updatedPipelineData = {
      ...project.pipelineData,
      questions: updatedQuestions,
    };

    try {
      const updatedProj = await httpApi.updateCheckpoint(
        projectId,
        currentStep,
        updatedPipelineData,
        "initializing"
      );
      setProject(updatedProj);
      toast.showToast("Draft saved successfully!", "success");
    } catch (err: any) {
      toast.showToast(err.message || "Failed to save draft", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // 5. Comments Section logic
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      const updatedProj = await httpApi.addComment(projectId, currentStep, commentText.trim());
      setProject(updatedProj);
      setCommentText("");
      toast.showToast("Comment posted!", "success");
    } catch (err: any) {
      toast.showToast(err.message || "Failed to add comment", "error");
    }
  };

  const handleCommentAction = async (commentId: string, action: "accepted" | "rejected") => {
    try {
      const updatedProj = await httpApi.handleComment(projectId, commentId, action);
      setProject(updatedProj);
      toast.showToast(`Comment ${action}!`, "success");
    } catch (err: any) {
      toast.showToast(err.message || "Failed to update comment status", "error");
    }
  };

  const stepsList = [
    "Product Tagline",
    "Problem Scope",
    "Target Audience",
    "Value Prop",
    "MVP Scope",
  ];

  const phaseList = [
    { key: "questions", label: "Questions" },
    { key: "analyzing", label: "Analysis" },
    { key: "deciding", label: "Feature Review" },
    { key: "generating", label: "Spec Generation" },
    { key: "complete", label: "Complete" },
  ];

  const currentPhaseIndex = phaseList.findIndex((p) => p.key === wizardPhase);

  return (
    <div
      className="w-full h-full flex flex-col bg-[#050508] text-white overflow-hidden p-6 gap-6"
      style={{ animation: "fadeIn 0.5s ease-out" }}
    >
      {/* ── Top Phase progress steps indicator ── */}
      <div className="flex-shrink-0 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          {phaseList.map((phaseObj, index) => {
            const isActive = phaseObj.key === wizardPhase;
            const isCompleted = index < currentPhaseIndex;

            return (
              <React.Fragment key={phaseObj.key}>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all duration-300 border ${
                      isActive
                        ? "bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                        : isCompleted
                        ? "bg-white/10 text-white/90 border-white/20"
                        : "bg-white/5 text-white/30 border-white/5"
                    }`}
                  >
                    {isCompleted ? "✓" : index + 1}
                  </div>
                  <div className="hidden md:block">
                    <div
                      className={`text-[9px] font-black uppercase tracking-wider ${
                        isActive ? "text-indigo-400" : isCompleted ? "text-white/60" : "text-white/30"
                      }`}
                    >
                      Phase {index + 1}
                    </div>
                    <div className={`text-xs font-semibold mt-0.5 ${isActive ? "text-white" : "text-white/40"}`}>
                      {phaseObj.label}
                    </div>
                  </div>
                </div>
                {index < phaseList.length - 1 && (
                  <div className={`flex-1 h-[1px] mx-2 transition-all duration-500 ${isCompleted ? "bg-indigo-500/30" : "bg-white/5"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Sub-progress bar for Q&A questions */}
        {wizardPhase === "questions" && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-2 animate-[fadeIn_0.3s_ease-out]">
            {stepsList.map((label, index) => {
              const stepNum = index + 1;
              const isSubActive = stepNum === currentStep;
              const isSubCompleted = stepNum < currentStep;

              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition-all duration-300 border ${
                        isSubActive
                          ? "bg-white text-black border-white shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                          : isSubCompleted
                          ? "bg-white/10 text-white/90 border-white/20"
                          : "bg-white/5 text-white/30 border-white/5"
                      }`}
                    >
                      {isSubCompleted ? "✓" : stepNum}
                    </div>
                    <span className={`text-[11px] font-medium hidden lg:inline ${isSubActive ? "text-white" : "text-white/40"}`}>
                      {label}
                    </span>
                  </div>
                  {index < stepsList.length - 1 && (
                    <div className={`flex-1 h-[1px] mx-1 transition-all duration-500 ${isSubCompleted ? "bg-white/20" : "bg-white/5"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Main wizard workspace ── */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        
        {/* Phase rendering */}
        {wizardPhase === "questions" && (
          <>
            {/* Left Card: Question and Answer */}
            <div
              className={`bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar ${
                hasOrg ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl mx-auto w-full"
              }`}
            >
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/50">
                    Question {currentStep} of 5
                  </span>
                  {!hasOrg ? (
                    <span className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-[9px] font-black uppercase tracking-widest text-purple-400">
                      Solo Workspace
                    </span>
                  ) : isLeader ? (
                    <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                      Team Leader Editor
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black uppercase tracking-widest text-cyan-400">
                      Collaborative Viewer
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold tracking-tight text-white leading-snug">
                    {currentQuestion.question}
                  </h2>
                  <p className="text-xs text-white/40">
                    {!hasOrg
                      ? "Describe this aspect of your product to capture its vision."
                      : isLeader
                      ? "Describe this aspect of your product. Your changes will be broadcast to team members in real-time."
                      : "View the team leader's response. You can comment on the right to verify or suggest adjustments."}
                  </p>
                </div>

                {/* Answer Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                    Product Spec Answer
                  </label>
                  <textarea
                    value={localAnswer}
                    onChange={(e) => isLeader && setLocalAnswer(e.target.value)}
                    disabled={!isLeader}
                    placeholder={
                      isLeader
                        ? "Enter detailed answer here..."
                        : "The team leader hasn't submitted an answer for this step yet."
                    }
                    rows={hasOrg ? 8 : 12}
                    className={`w-full rounded-2xl bg-black/40 border p-4 text-sm leading-relaxed text-white focus:outline-none focus:ring-1 transition-all resize-none ${
                      isLeader
                        ? "border-white/10 focus:border-white/30 focus:ring-white/20"
                        : "border-white/5 bg-black/20 text-white/60 cursor-not-allowed"
                    }`}
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
                <div>
                  {isLeader && (
                    <button
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                      className="h-10 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50"
                    >
                      {isSaving ? "Saving..." : "Save Draft"}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {currentStep > 1 && isLeader && (
                    <button
                      onClick={() => handleProgress(currentStep - 1)}
                      disabled={isSaving}
                      className="h-10 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all disabled:opacity-50"
                    >
                      Back
                    </button>
                  )}

                  {isLeader ? (
                    currentStep < 5 ? (
                      <button
                        onClick={() => handleProgress(currentStep + 1)}
                        disabled={isSaving || !localAnswer.trim()}
                        className="h-10 px-6 rounded-xl text-xs font-bold bg-white text-black hover:bg-white/90 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                      >
                        {isSaving ? "Saving..." : "Next Step"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleProgress(5, true)}
                        disabled={isSaving || !localAnswer.trim()}
                        className="h-10 px-6 rounded-xl text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      >
                        {isSaving ? "Finalizing..." : "Finalize Answers & Analyze"}
                      </button>
                    )
                  ) : (
                    <div className="text-xs text-white/30 italic flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Waiting for team leader to proceed...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Card: Collaborative verification Comments */}
            {hasOrg && (
              <div className="lg:col-span-5 bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 flex flex-col overflow-hidden">
                <div className="flex-shrink-0 border-b border-white/5 pb-4 mb-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Team Feed & Verification
                  </h3>
                  <p className="text-[11px] text-white/40 mt-1">
                    Collaborative verification comments for this step.
                  </p>
                </div>

                {/* List of comments */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                  {!currentQuestion.comments || currentQuestion.comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 space-y-2">
                      <span className="font-mono text-[10px] tracking-widest px-2.5 py-1 rounded bg-white/5 text-white/40 uppercase font-bold border border-white/10">FEED EMPTY</span>
                      <p className="text-xs">No comments posted yet.</p>
                      <p className="text-[10px] text-white/20">
                        Be the first to suggest changes or verify this answer.
                      </p>
                    </div>
                  ) : (
                    currentQuestion.comments.map((comment: any) => (
                      <div
                        key={comment.id}
                        className="p-3.5 rounded-2xl border border-white/5 bg-black/25 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                              {comment.displayName ? comment.displayName[0].toUpperCase() : "U"}
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white/85">
                                {comment.displayName}
                              </div>
                              <div className="text-[9px] text-white/30">
                                {new Date(comment.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              comment.status === "accepted"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : comment.status === "rejected"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {comment.status}
                          </span>
                        </div>

                        <p className="text-xs text-white/70 leading-relaxed pl-8">
                          {comment.text}
                        </p>

                        {isLeader && comment.status === "pending" && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5 pl-8">
                            <button
                              onClick={() => handleCommentAction(comment.id, "rejected")}
                              className="h-7 px-3 rounded-lg text-[10px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all border border-red-500/10"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleCommentAction(comment.id, "accepted")}
                              className="h-7 px-3 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all border border-emerald-500/10"
                            >
                              Accept & Verify
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={handlePostComment}
                  className="flex-shrink-0 border-t border-white/5 pt-4 mt-4 flex gap-2"
                >
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Suggest adjustments or comment to verify..."
                    className="flex-1 h-10 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="h-10 px-4 rounded-xl text-xs font-bold bg-white/10 border border-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-all"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Analyzing Phase */}
        {wizardPhase === "analyzing" && (
          <div className="lg:col-span-12 flex flex-col items-center justify-center p-12 text-center bg-white/[0.01] border border-white/[0.04] rounded-3xl h-full relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />
            <div className="relative flex flex-col items-center gap-6 max-w-md">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold tracking-tight text-white">Analyzing Vision</h2>
                <p className="text-sm text-white/40 leading-relaxed">
                  The AI is processing your team's answers to outline core specifications and suggests features.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deciding (Feature Review) Phase */}
        {wizardPhase === "deciding" && (
          <>
            {/* Left Card: Feature Review Card */}
            <div
              className={`bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 flex flex-col justify-between overflow-y-auto custom-scrollbar ${
                hasOrg ? "lg:col-span-7" : "lg:col-span-12 max-w-4xl mx-auto w-full"
              }`}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[9px] font-black uppercase tracking-widest text-indigo-400">
                    Feature {currentFeatureIdx + 1} of {featureQueue.length}
                  </span>
                  {isLeader ? (
                    <span className="text-[10px] text-emerald-400 font-bold">Review Required</span>
                  ) : (
                    <span className="text-[10px] text-white/30 italic">Viewing live decisions</span>
                  )}
                </div>

                <div className="space-y-3">
                  <h2 className="text-xl font-extrabold tracking-tight text-white leading-snug">
                    {featureQueue[currentFeatureIdx]?.title || "Review Feature"}
                  </h2>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] min-h-[100px] text-sm text-white/70 leading-relaxed">
                    {featureQueue[currentFeatureIdx]?.description ||
                      featureQueue[currentFeatureIdx]?.rationale ||
                      "No additional details provided by AI. Do you want to include this feature in your project scope?"}
                  </div>
                </div>

                {/* Optional Decision feedback/comment */}
                {isLeader && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                      Decision Note (Optional)
                    </label>
                    <textarea
                      value={featureComment}
                      onChange={(e) => setFeatureComment(e.target.value)}
                      placeholder="Add any feedback, custom adjustments, or rationale..."
                      rows={3}
                      className="w-full rounded-xl bg-black/40 border border-white/10 p-3.5 text-xs text-white focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all resize-none"
                    />
                  </div>
                )}

                {/* Decision lists */}
                {featureDecisions.length > 0 && (
                  <div className="space-y-2 border-t border-white/5 pt-4">
                    <label className="text-[9px] font-black uppercase tracking-widest text-white/30">
                      Reviewed features ({featureDecisions.length})
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar">
                      {featureDecisions.map((dec, i) => (
                        <div
                          key={dec.id || i}
                          className={`px-2.5 py-1 rounded-lg border text-[10px] font-medium flex items-center gap-1.5 ${
                            dec.status === "approved"
                              ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-400"
                              : "bg-red-500/5 border-red-500/10 text-red-400"
                          }`}
                        >
                          <span>{dec.status === "approved" ? "✓" : "✗"}</span>
                          <span className="truncate max-w-[120px]">{dec.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between border-t border-white/5 pt-6 mt-8">
                <div>
                  {currentFeatureIdx > 0 && isLeader && (
                    <button
                      onClick={handleBackFeature}
                      className="h-10 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white transition-all"
                    >
                      Back Feature
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isLeader ? (
                    <>
                      <button
                        onClick={() => handleFeatureDecision("rejected")}
                        className="h-10 px-5 rounded-xl text-xs font-bold bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        Reject Feature
                      </button>
                      <button
                        onClick={() => handleFeatureDecision("approved")}
                        className="h-10 px-6 rounded-xl text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      >
                        Approve & Include
                      </button>
                    </>
                  ) : (
                    <div className="text-xs text-white/30 italic flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      Waiting for team leader decisions...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Card: Collaborative Feed / Comments for Deciding phase */}
            {hasOrg && (
              <div className="lg:col-span-5 bg-white/[0.02] border border-white/[0.06] rounded-3xl p-6 flex flex-col overflow-hidden">
                <div className="flex-shrink-0 border-b border-white/5 pb-4 mb-4">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                    Team Discussion
                  </h3>
                  <p className="text-[11px] text-white/40 mt-1">
                    Suggest adjustments or coordinate features in real-time.
                  </p>
                </div>

                {/* List of comments from step 5 */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                  {!questions[4]?.comments || questions[4].comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 space-y-2">
                      <span className="font-mono text-[10px] tracking-widest px-2.5 py-1 rounded bg-white/5 text-white/40 uppercase font-bold border border-white/10">FEED EMPTY</span>
                      <p className="text-xs">No comments posted.</p>
                    </div>
                  ) : (
                    questions[4].comments.map((comment: any) => (
                      <div
                        key={comment.id}
                        className="p-3.5 rounded-2xl border border-white/5 bg-black/25 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white/85">
                            {comment.displayName}
                          </span>
                          <span className="text-[9px] text-white/30">
                            {new Date(comment.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed pl-2">
                          {comment.text}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form
                  onSubmit={handlePostComment}
                  className="flex-shrink-0 border-t border-white/5 pt-4 mt-4 flex gap-2"
                >
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Coordinate with your team..."
                    className="flex-1 h-10 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim()}
                    className="h-10 px-4 rounded-xl text-xs font-bold bg-white/10 border border-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-all"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* Generating Spec Phase */}
        {wizardPhase === "generating" && (
          <div className="lg:col-span-12 flex flex-col items-center justify-center p-12 text-center bg-white/[0.01] border border-white/[0.04] rounded-3xl h-full relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />
            <div className="relative flex flex-col items-center gap-6 max-w-md animate-pulse">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                <div className="absolute inset-0 rounded-full border-t-2 border-emerald-400 animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold tracking-tight text-white animate-pulse">Generating Spec Details</h2>
                <p className="text-sm text-white/40 leading-relaxed">
                  Assembling project scope, value propositions, feature sets, and milestones into a structured product plan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Complete Phase */}
        {wizardPhase === "complete" && (
          <div className="lg:col-span-12 flex flex-col justify-between h-full bg-white/[0.01] border border-white/[0.05] rounded-3xl p-6 overflow-hidden">
            <div className="space-y-4 min-h-0 flex-1 flex flex-col">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4 flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg font-bold">✓</div>
                <div>
                  <h2 className="text-lg font-extrabold text-white">Project Specification Completed!</h2>
                  <p className="text-xs text-white/40">AI structured product details are ready. Enter the IDE to start building.</p>
                </div>
              </div>

              {/* Scrollable spec preview */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-6 py-2 min-h-0 text-sm text-white/70">
                {generatedDoc ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Metadata Card */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                      <h3 className="text-xs font-black text-white/80 uppercase tracking-widest border-b border-white/[0.05] pb-2">Idea Metadata</h3>
                      <div className="text-xs"><strong>Name:</strong> {generatedDoc.ideaMetadata?.ideaName || project.name}</div>
                      <div className="text-xs"><strong>Tagline:</strong> {generatedDoc.ideaMetadata?.tagline || "N/A"}</div>
                      <div className="text-xs"><strong>Summary:</strong> {generatedDoc.ideaMetadata?.summary || "N/A"}</div>
                      <div className="text-xs"><strong>Category:</strong> <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90">{generatedDoc.ideaMetadata?.category || "N/A"}</span></div>
                    </div>

                    {/* Problem Statement */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                      <h3 className="text-xs font-black text-white/80 uppercase tracking-widest border-b border-white/[0.05] pb-2">The Problem</h3>
                      <div className="text-xs"><strong>Statement:</strong> {generatedDoc.problem?.problemStatement || "N/A"}</div>
                      <div className="text-xs"><strong>Urgency:</strong> <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-bold uppercase tracking-wider">{generatedDoc.problem?.urgencyLevel || "N/A"}</span></div>
                      {generatedDoc.problem?.painPoints && generatedDoc.problem.painPoints.length > 0 && (
                        <div>
                          <div className="text-[9px] uppercase text-white/40 font-bold mb-1">Pain Points</div>
                          <ul className="list-disc pl-4 text-xs text-white/60 space-y-1">
                            {generatedDoc.problem.painPoints.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Solution Card */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                      <h3 className="text-xs font-black text-white/80 uppercase tracking-widest border-b border-white/[0.05] pb-2">The Solution</h3>
                      <div className="text-xs"><strong>Core innovation:</strong> {generatedDoc.solution?.coreInnovation || "N/A"}</div>
                      <div className="text-xs"><strong>Value Prop:</strong> {generatedDoc.solution?.valueProposition || "N/A"}</div>
                      {generatedDoc.solution?.keyBenefits && generatedDoc.solution.keyBenefits.length > 0 && (
                        <div>
                          <div className="text-[9px] uppercase text-white/40 font-bold mb-1">Benefits</div>
                          <ul className="list-disc pl-4 text-xs text-white/60 space-y-1">
                            {generatedDoc.solution.keyBenefits.map((b: string, i: number) => <li key={i}>{b}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Features Card */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                      <h3 className="text-xs font-black text-white/80 uppercase tracking-widest border-b border-white/[0.05] pb-2">Approved Features</h3>
                      {generatedDoc.product?.coreFeatures && generatedDoc.product.coreFeatures.length > 0 ? (
                        <ul className="list-disc pl-4 text-xs text-white/60 space-y-1.5">
                          {generatedDoc.product.coreFeatures.map((f: string, i: number) => <li key={i}>{f}</li>)}
                        </ul>
                      ) : (
                        <div className="text-xs text-white/30 italic">No core features listed.</div>
                      )}
                    </div>

                    {/* Technical Architecture */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                      <h3 className="text-xs font-black text-white/80 uppercase tracking-widest border-b border-white/[0.05] pb-2">Technical Architecture</h3>
                      <div className="text-xs"><strong>Frontend:</strong> {generatedDoc.technicalArchitecture?.frontend || "N/A"}</div>
                      <div className="text-xs"><strong>Backend:</strong> {generatedDoc.technicalArchitecture?.backend || "N/A"}</div>
                      <div className="text-xs"><strong>Database:</strong> {generatedDoc.technicalArchitecture?.database || "N/A"}</div>
                    </div>

                    {/* MVP Goal */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.05] flex flex-col gap-3">
                      <h3 className="text-xs font-black text-white/80 uppercase tracking-widest border-b border-white/[0.05] pb-2">MVP Plan</h3>
                      <div className="text-xs"><strong>MVP Goal:</strong> {generatedDoc.mvpPlan?.mvpGoal || "N/A"}</div>
                      <div className="text-xs"><strong>Time Estimate:</strong> {generatedDoc.mvpPlan?.developmentTimeEstimate || "N/A"}</div>
                      {generatedDoc.mvpPlan?.mustHaveFeatures && generatedDoc.mvpPlan.mustHaveFeatures.length > 0 && (
                        <div>
                          <div className="text-[9px] uppercase text-white/40 font-bold mb-1">Must-Haves</div>
                          <ul className="list-disc pl-4 text-xs text-white/60 space-y-1">
                            {generatedDoc.mvpPlan.mustHaveFeatures.slice(0, 4).map((f: string, i: number) => <li key={i}>{f}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-white/30 italic">
                    Spec generated successfully but details are not available. Click Enter Workspace to proceed.
                  </div>
                )}
              </div>
            </div>

            {/* Action footer */}
            <div className="flex items-center justify-end border-t border-white/5 pt-4 mt-4 flex-shrink-0">
              {isLeader ? (
                <button
                  onClick={handleEnterIDE}
                  disabled={isSaving}
                  className="h-11 px-8 rounded-xl text-xs font-bold bg-emerald-500 text-black hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {isSaving ? "Entering..." : "Enter Workspace & Initialize IDE"}
                </button>
              ) : (
                <div className="text-xs text-white/30 italic flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Waiting for team leader to open the workspace...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
