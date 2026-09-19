import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { useToast } from '../context/ToastContext';
import { httpApi } from '../hooks/useHttpApi';
import StructuredAiResponseCard from '../components/ui/StructuredAiResponse';
import { normalizeAiResponse, type StructuredAiResponse } from '../utils/aiResponse';
import { getSampleProjectIdeaJson } from '../utils/projectTemplates';

interface IdeaWorkshopProps {
    projectName: string;
    projectId?: string;
    initialIdea?: string;
    fullScreen?: boolean;
    onRefined: (refinedIdea: string) => void | Promise<void>;
    onCancel: () => void;
}

type Phase = 'input' | 'analyzing' | 'discussion' | 'refining' | 'complete' | 'failure';
type FeaturePriority = 'critical' | 'high' | 'medium' | 'low';
type FeatureStatus = 'pending' | 'approved' | 'rejected';

interface IdeaUnderstanding {
    core_problem: string;
    intended_solution: string;
    target_users: string[];
    explicit_requirements: string[];
    inferred_requirements: string[];
    constraints: string[];
    assumptions: string[];
    context_notes: string[];
}

interface FeatureDecision {
    id: string;
    title: string;
    description: string;
    rationale: string;
    priority: FeaturePriority;
    include: boolean;
    rating: 1 | 2 | 3 | 4 | 5;
    status: FeatureStatus;
    comment: string;
    integratedSummary: string;
    detailsRequested: boolean;
    clarifying_questions?: string[];
}

interface IdeaAnalysisResult {
    score: number;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    questions: string[];
    suggestions: string[];
    understanding: IdeaUnderstanding;
    major_capabilities: string[];
    feature_queue: FeatureDecision[];
    structured_concept: RefinedIdeaDoc | null;
}

interface RefinedFeatureItem {
    feature: string;
    include: boolean;
    rating: number;
    rationale: string;
}

interface RefinedMilestoneItem {
    milestone: string;
    scope: string;
    owner_role: string;
    eta: string;
}

interface RefinedRiskItem {
    risk: string;
    impact: string;
    mitigation: string;
}

interface RefinedIdeaDoc {
    title: string;
    summary: string;
    target_audience: string[];
    core_value_proposition: string[];
    problem_statement: string[];
    decision_summary: string[];
    key_features: RefinedFeatureItem[];
    user_flows: string[];
    technical_architecture: string[];
    data_api_requirements: string[];
    milestones: RefinedMilestoneItem[];
    success_metrics: string[];
    risks: RefinedRiskItem[];
    implementation_checklist: string[];
    open_questions: string[];
}

const QUICK_PROMPTS = [
    'What is the biggest market risk here?',
    'Suggest an MVP scope for 4 weeks.',
    'What should we cut to ship faster?',
    'What metrics should we track in v1?',
    'Give a clearer pricing strategy.',
    'What technical stack is safest for launch?',
];

const WORKFLOW_STEPS = ['Capture', 'Analyze', 'Decide', 'Finalize'];

const IDEA_SECTION_TEMPLATES = [
    {
        id: 'problem',
        label: 'Problem',
        content:
            '## Problem\n- What pain point exists today?\n- Who is affected and how often?\n- Why current alternatives fail?',
    },
    {
        id: 'users',
        label: 'Users',
        content:
            '## Target Users\n- Primary users:\n- Secondary users:\n- User context and constraints:',
    },
    {
        id: 'value',
        label: 'Value',
        content:
            '## Value Proposition\n- Core value:\n- Differentiator:\n- Why users will switch:',
    },
    {
        id: 'mvp',
        label: 'MVP',
        content:
            '## MVP Scope\n- Must-have features:\n- Nice-to-have features:\n- Out of scope for v1:',
    },
    {
        id: 'constraints',
        label: 'Constraints',
        content:
            '## Constraints\n- Timeline:\n- Budget/team:\n- Technical constraints:\n- Compliance/security constraints:',
    },
];

const FULL_IDEA_TEMPLATE = `## Problem
- What pain point exists today?
- Who is affected and how often?
- Why current alternatives fail?

## Target Users
- Primary users:
- Secondary users:
- User context and constraints:

## Value Proposition
- Core value:
- Differentiator:
- Why users will switch:

## MVP Scope
- Must-have features:
- Nice-to-have features:
- Out of scope for v1:

## Constraints
- Timeline:
- Budget/team:
- Technical constraints:
- Compliance/security constraints:

## Success Metrics
- Metric 1:
- Metric 2:
- Metric 3:`;

const IDEA_READINESS_CHECKS = [
    { id: 'problem', label: 'Problem clarity', pattern: /(problem|pain|challenge|issue)/i },
    { id: 'users', label: 'Target users', pattern: /(user|audience|customer|persona)/i },
    { id: 'value', label: 'Value proposition', pattern: /(value|benefit|outcome|advantage)/i },
    { id: 'scope', label: 'MVP scope', pattern: /(mvp|feature|scope|must-have)/i },
    { id: 'constraints', label: 'Constraints', pattern: /(constraint|timeline|budget|risk|limitation)/i },
];

function toFeatureDecisionId(label: string, index: number): string {
    const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return `feature-${index}-${normalized || 'item'}`;
}

function buildFeatureDecisions(analysis: any): FeatureDecision[] {
    const queue = Array.isArray(analysis?.feature_queue) ? analysis.feature_queue : [];
    if (queue.length > 0) {
        return queue
            .map((item: any, index: number) => {
                const title = typeof item?.title === 'string' ? item.title.trim() : '';
                if (!title) return null;
                const priority = ['critical', 'high', 'medium', 'low'].includes(String(item?.priority).toLowerCase())
                    ? String(item.priority).toLowerCase() as FeaturePriority
                    : 'medium';
                const ratingValue = Number(item?.rating);
                const rating = Number.isFinite(ratingValue)
                    ? Math.max(1, Math.min(5, Math.round(ratingValue))) as 1 | 2 | 3 | 4 | 5
                    : (priority === 'critical' ? 5 : priority === 'high' ? 4 : 3);
                const status = ['approved', 'rejected', 'pending'].includes(String(item?.status).toLowerCase())
                    ? String(item.status).toLowerCase() as FeatureStatus
                    : 'pending';

                return {
                    id: typeof item?.id === 'string' && item.id.trim() ? item.id.trim() : toFeatureDecisionId(title, index),
                    title,
                    description: typeof item?.description === 'string' ? item.description.trim() : '',
                    rationale: typeof item?.rationale === 'string' ? item.rationale.trim() : '',
                    priority,
                    include: status !== 'rejected',
                    rating,
                    status,
                    comment: typeof item?.user_comment === 'string'
                        ? item.user_comment.trim()
                        : typeof item?.comment === 'string'
                            ? item.comment.trim()
                            : '',
                    integratedSummary: typeof item?.integrated_summary === 'string'
                        ? item.integrated_summary.trim()
                        : typeof item?.integratedSummary === 'string'
                            ? item.integratedSummary.trim()
                            : '',
                    detailsRequested: false,
                    clarifying_questions: Array.isArray(item?.clarifying_questions)
                        ? item.clarifying_questions.filter((q: any) => typeof q === 'string')
                        : Array.isArray(item?.clarifyingQuestions)
                            ? item.clarifyingQuestions.filter((q: any) => typeof q === 'string')
                            : [],
                };
            })
            .filter((item: FeatureDecision | null): item is FeatureDecision => item !== null)
            .slice(0, 10);
    }

    const source = Array.isArray(analysis?.suggestions) && analysis.suggestions.length > 0
        ? analysis.suggestions
        : [
            'Define core MVP feature set',
            'Design onboarding flow',
            'Set pricing strategy',
            'Create launch metrics dashboard',
        ];

    return source
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim())
        .filter((item: string) => Boolean(item))
        .slice(0, 8)
        .map((title: string, index: number) => ({
            id: toFeatureDecisionId(title, index),
            title,
            description: '',
            rationale: '',
            priority: index < 2 ? 'high' as const : 'medium' as const,
            include: true,
            rating: (index === 0 ? 4 : 3) as 1 | 2 | 3 | 4 | 5,
            status: 'pending' as const,
            comment: '',
            integratedSummary: '',
            detailsRequested: false,
        }));
}

function getRatingStyle(value: number) {
    if (value >= 4) return 'bg-white/15 border-white/30 text-white';
    if (value >= 3) return 'bg-white/10 border-white/20 text-white/70';
    return 'bg-white/5 border-white/10 text-white/40';
}

function getPriorityStyle(priority: FeaturePriority) {
    if (priority === 'critical') return 'bg-white/20 border-white/40 text-white font-black';
    if (priority === 'high') return 'bg-white/15 border-white/30 text-white/90';
    if (priority === 'medium') return 'bg-white/10 border-white/20 text-white/70';
    return 'bg-white/5 border-white/10 text-white/40';
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function toStringList(value: unknown, maxItems = 20): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeRefinedDoc(payload: unknown): RefinedIdeaDoc | null {
    const source = toRecord(payload);
    if (!source) return null;

    const keyFeatures = Array.isArray(source.key_features)
        ? source.key_features
            .map((item) => {
                const row = toRecord(item);
                if (!row) return null;
                const feature = typeof row.feature === 'string' ? row.feature.trim() : '';
                if (!feature) return null;
                return {
                    feature,
                    include: typeof row.include === 'boolean' ? row.include : true,
                    rating: Number.isFinite(Number(row.rating)) ? Math.max(1, Math.min(5, Math.round(Number(row.rating)))) : 3,
                    rationale: typeof row.rationale === 'string' ? row.rationale.trim() : '',
                };
            })
            .filter((item): item is RefinedFeatureItem => !!item)
            .slice(0, 30)
        : [];

    const milestones = Array.isArray(source.milestones)
        ? source.milestones
            .map((item) => {
                const row = toRecord(item);
                if (!row) return null;
                const milestone = typeof row.milestone === 'string' ? row.milestone.trim() : '';
                if (!milestone) return null;
                return {
                    milestone,
                    scope: typeof row.scope === 'string' ? row.scope.trim() : '',
                    owner_role: typeof row.owner_role === 'string' ? row.owner_role.trim() : '',
                    eta: typeof row.eta === 'string' ? row.eta.trim() : '',
                };
            })
            .filter((item): item is RefinedMilestoneItem => !!item)
            .slice(0, 20)
        : [];

    const risks = Array.isArray(source.risks)
        ? source.risks
            .map((item) => {
                const row = toRecord(item);
                if (!row) return null;
                const risk = typeof row.risk === 'string' ? row.risk.trim() : '';
                if (!risk) return null;
                return {
                    risk,
                    impact: typeof row.impact === 'string' ? row.impact.trim() : '',
                    mitigation: typeof row.mitigation === 'string' ? row.mitigation.trim() : '',
                };
            })
            .filter((item): item is RefinedRiskItem => !!item)
            .slice(0, 20)
        : [];

    const doc: RefinedIdeaDoc = {
        title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : 'Product Vision',
        summary: typeof source.summary === 'string' ? source.summary.trim() : '',
        target_audience: toStringList(source.target_audience),
        core_value_proposition: toStringList(source.core_value_proposition),
        problem_statement: toStringList(source.problem_statement),
        decision_summary: toStringList(source.decision_summary),
        key_features: keyFeatures,
        user_flows: toStringList(source.user_flows),
        technical_architecture: toStringList(source.technical_architecture),
        data_api_requirements: toStringList(source.data_api_requirements),
        milestones,
        success_metrics: toStringList(source.success_metrics),
        risks,
        implementation_checklist: toStringList(source.implementation_checklist, 40),
        open_questions: toStringList(source.open_questions),
    };

    const hasContent =
        !!doc.summary ||
        doc.target_audience.length > 0 ||
        doc.key_features.length > 0 ||
        doc.milestones.length > 0 ||
        doc.risks.length > 0;

    return hasContent ? doc : null;
}

function normalizeIdeaUnderstanding(payload: unknown): IdeaUnderstanding {
    const source = toRecord(payload) || {};
    return {
        core_problem: typeof source.core_problem === 'string' ? source.core_problem.trim() : '',
        intended_solution: typeof source.intended_solution === 'string' ? source.intended_solution.trim() : '',
        target_users: toStringList(source.target_users ?? source.targetUsers, 10),
        explicit_requirements: toStringList(source.explicit_requirements ?? source.explicitRequirements, 14),
        inferred_requirements: toStringList(source.inferred_requirements ?? source.inferredRequirements, 14),
        constraints: toStringList(source.constraints, 12),
        assumptions: toStringList(source.assumptions, 12),
        context_notes: toStringList(source.context_notes ?? source.contextNotes, 12),
    };
}

function normalizeAnalysisResult(payload: unknown): IdeaAnalysisResult | null {
    const source = toRecord(payload);
    if (!source) return null;

    const scoreValue = Number(source.score);

    return {
        score: Number.isFinite(scoreValue) ? Math.max(0, Math.min(100, Math.round(scoreValue))) : 0,
        summary: typeof source.summary === 'string' ? source.summary.trim() : '',
        strengths: toStringList(source.strengths, 8),
        weaknesses: toStringList(source.weaknesses, 8),
        questions: toStringList(source.questions, 8),
        suggestions: toStringList(source.suggestions, 8),
        understanding: normalizeIdeaUnderstanding(source.understanding),
        major_capabilities: toStringList(source.major_capabilities ?? source.majorCapabilities, 10),
        feature_queue: buildFeatureDecisions(source),
        structured_concept: normalizeRefinedDoc(source.structured_concept ?? source.structuredConcept),
    };
}

function docToMarkdown(doc: RefinedIdeaDoc): string {
    const lines: string[] = [];
    lines.push(`# ${doc.title || 'Product Vision'}`);
    if (doc.summary) lines.push(doc.summary);

    const pushList = (title: string, list: string[]) => {
        lines.push(`## ${title}`);
        if (list.length === 0) {
            lines.push('- N/A');
            return;
        }
        lines.push(...list.map((item) => `- ${item}`));
    };

    pushList('Target Audience', doc.target_audience);
    pushList('Core Value Proposition', doc.core_value_proposition);
    pushList('Problem Statement', doc.problem_statement);
    pushList('Decision Summary', doc.decision_summary);

    lines.push('## Key Features');
    lines.push('| Feature | Include | Rating | Rationale |');
    lines.push('|---|---|---|---|');
    if (doc.key_features.length === 0) {
        lines.push('| N/A | Yes | 3/5 | Pending detail |');
    } else {
        doc.key_features.forEach((row) => {
            lines.push(`| ${row.feature.replace(/\|/g, '\\|')} | ${row.include ? 'Yes' : 'No'} | ${row.rating}/5 | ${(row.rationale || '-').replace(/\|/g, '\\|')} |`);
        });
    }

    pushList('User Flows', doc.user_flows);
    pushList('Technical Architecture', doc.technical_architecture);
    pushList('Data & API Requirements', doc.data_api_requirements);

    lines.push('## Milestones');
    lines.push('| Milestone | Scope | Owner/Role | ETA |');
    lines.push('|---|---|---|---|');
    if (doc.milestones.length === 0) {
        lines.push('| N/A | Define next step | Team | TBD |');
    } else {
        doc.milestones.forEach((row) => {
            lines.push(`| ${row.milestone.replace(/\|/g, '\\|')} | ${(row.scope || '-').replace(/\|/g, '\\|')} | ${(row.owner_role || '-').replace(/\|/g, '\\|')} | ${(row.eta || 'TBD').replace(/\|/g, '\\|')} |`);
        });
    }

    pushList('Success Metrics', doc.success_metrics);

    lines.push('## Risks');
    lines.push('| Risk | Impact | Mitigation |');
    lines.push('|---|---|---|');
    if (doc.risks.length === 0) {
        lines.push('| N/A | - | Define mitigation |');
    } else {
        doc.risks.forEach((row) => {
            lines.push(`| ${row.risk.replace(/\|/g, '\\|')} | ${(row.impact || '-').replace(/\|/g, '\\|')} | ${(row.mitigation || '-').replace(/\|/g, '\\|')} |`);
        });
    }

    pushList('Implementation Checklist', doc.implementation_checklist);
    pushList('Open Questions', doc.open_questions);

    return lines.join('\n\n');
}

export default function IdeaWorkshop({
    projectName,
    projectId,
    initialIdea = '',
    fullScreen = false,
    onRefined,
    onCancel,
}: IdeaWorkshopProps) {
    const toast = useToast();
    const chatEndRef = useRef<HTMLDivElement>(null);

    const [phase, setPhase] = useState<Phase>('input');
    const [idea, setIdea] = useState(initialIdea ?? '');
    const [analysis, setAnalysis] = useState<IdeaAnalysisResult | null>(null);
    const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string; structured?: StructuredAiResponse }[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const [refinedIdea, setRefinedIdea] = useState('');
    const [refinedDoc, setRefinedDoc] = useState<RefinedIdeaDoc | null>(null);
    const [workingDoc, setWorkingDoc] = useState<RefinedIdeaDoc | null>(null);
    const [copied, setCopied] = useState(false);
    const [jsonCopied, setJsonCopied] = useState(false);
    const [featureDecisions, setFeatureDecisions] = useState<FeatureDecision[]>([]);
    const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
    const [newFeature, setNewFeature] = useState('');
    const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
    const [isPersistingFinalPlan, setIsPersistingFinalPlan] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [lastPhaseBeforeFailure, setLastPhaseBeforeFailure] = useState<Phase>('input');

    // Guided Refinement States
    const [questionAnswers, setQuestionAnswers] = useState<Record<string, Record<number, string>>>({});

    const draftStorageKey = useMemo(
        () => `akasha:idea-workshop:draft:${projectId || projectName}`,
        [projectId, projectName]
    );

    const workshopStorageKey = useMemo(
        () => `akasha:idea-workshop:state:${projectId || projectName}`,
        [projectId, projectName]
    );

    const selectedFeatures = useMemo(
        () => featureDecisions.filter((feature) => feature.status === 'approved' && feature.include),
        [featureDecisions]
    );

    const averageRating = useMemo(() => {
        if (selectedFeatures.length === 0) return 0;
        const sum = selectedFeatures.reduce((acc, item) => acc + item.rating, 0);
        return Number((sum / selectedFeatures.length).toFixed(1));
    }, [selectedFeatures]);

    const priorityFeatures = useMemo(
        () => selectedFeatures.filter((item) => item.rating >= 4),
        [selectedFeatures]
    );

    const queueComplete = useMemo(
        () => featureDecisions.length > 0 && !featureDecisions.some((feature) => feature.status === 'pending'),
        [featureDecisions]
    );

    const canDraftFinalDoc = queueComplete && selectedFeatures.length > 0;
    const currentFeatureIndex = useMemo(
        () => featureDecisions.findIndex((feature) => feature.status === 'pending'),
        [featureDecisions]
    );
    const currentFeature = currentFeatureIndex >= 0 ? featureDecisions[currentFeatureIndex] : null;
    const activeFeature = useMemo(() => {
        if (selectedFeatureId) {
            return featureDecisions.find((f) => f.id === selectedFeatureId) || currentFeature;
        }
        return currentFeature;
    }, [featureDecisions, selectedFeatureId, currentFeature]);
    const activeStep = useMemo(() => {
        if (phase === 'input') return 1;
        if (phase === 'analyzing') return 2;
        if (phase === 'discussion') return 3;
        return 4;
    }, [phase]);

    const ideaWordCount = useMemo(() => {
        const words = idea.trim().split(/\s+/).filter(Boolean);
        return words.length;
    }, [idea]);

    const readinessChecks = useMemo(
        () => IDEA_READINESS_CHECKS.map((check) => ({ ...check, done: check.pattern.test(idea) })),
        [idea]
    );

    const ideaReadinessScore = useMemo(() => {
        if (readinessChecks.length === 0) return 0;
        const base = readinessChecks.filter((check) => check.done).length / readinessChecks.length;
        const lengthBonus = ideaWordCount >= 120 ? 0.2 : ideaWordCount >= 60 ? 0.1 : 0;
        return Math.min(100, Math.round((base + lengthBonus) * 100));
    }, [ideaWordCount, readinessChecks]);

    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [history, isChatting]);

    useEffect(() => {
        if ((initialIdea ?? '').trim()) return;
        const saved = localStorage.getItem(draftStorageKey);
        if (saved && saved.trim()) {
            setIdea(saved);
        }
    }, [draftStorageKey, initialIdea]);

    useEffect(() => {
        if (!idea.trim()) {
            localStorage.removeItem(draftStorageKey);
            return;
        }
        localStorage.setItem(draftStorageKey, idea);
    }, [draftStorageKey, idea]);

    const loadedSavedState = useRef(false);
    useEffect(() => {
        if (loadedSavedState.current) return;
        if (initialIdea?.trim()) return;
        try {
            const saved = localStorage.getItem(workshopStorageKey);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (!parsed || typeof parsed !== 'object') return;
            const savedAnalysis = parsed.analysis;
            const savedFeatures = parsed.featureDecisions;
            const savedWorkingDoc = parsed.workingDoc;
            const savedHistory = parsed.history;
            if (savedAnalysis && Array.isArray(savedFeatures)) {
                loadedSavedState.current = true;
                setAnalysis(savedAnalysis);
                setFeatureDecisions(savedFeatures);
                if (savedWorkingDoc) setWorkingDoc(savedWorkingDoc);
                if (Array.isArray(savedHistory)) setHistory(savedHistory);
                setPhase('discussion');
            }
        } catch {
            // Ignore corrupt saved state
        }
    }, [workshopStorageKey, initialIdea]);

    // Debounced save of full workshop state (only in discussion/complete phase)
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (phase !== 'discussion' && phase !== 'complete') return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            try {
                localStorage.setItem(workshopStorageKey, JSON.stringify({
                    analysis,
                    featureDecisions,
                    workingDoc,
                    history,
                }));
            } catch {
                // localStorage full or unavailable - ignore
            }
        }, 1500);
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    }, [phase, analysis, featureDecisions, workingDoc, history, workshopStorageKey]);

    const appendTemplateContent = (content: string) => {
        setIdea((prev) => {
            const trimmed = prev.trimEnd();
            if (!trimmed) return content;
            return `${trimmed}\n\n${content}`;
        });
    };

    const applySectionTemplate = (templateId: string) => {
        const template = IDEA_SECTION_TEMPLATES.find((item) => item.id === templateId);
        if (!template) return;
        appendTemplateContent(template.content);
    };

    const applyFullTemplate = () => {
        if (!idea.trim()) {
            setIdea(FULL_IDEA_TEMPLATE);
            return;
        }
        appendTemplateContent(FULL_IDEA_TEMPLATE);
    };

    const applySampleJsonTemplate = () => {
        const sampleJson = getSampleProjectIdeaJson(projectName);
        if (!idea.trim()) {
            setIdea(sampleJson);
            return;
        }

        if (idea.trim() === sampleJson.trim()) {
            return;
        }

        appendTemplateContent(sampleJson);
    };

    const runAnalyze = async (overrideText?: string) => {
        const ideaText = typeof overrideText === 'string' ? overrideText : idea;
        if (!ideaText.trim()) {
            toast.showToast('Please describe your idea first.', 'warning');
            return;
        }

        setPhase('analyzing');
        setAnalysis(null);
        setWorkingDoc(null);
        setFeatureDecisions([]);
        setRefinedDoc(null);
        setRefinedIdea('');
        try {
            const result = normalizeAnalysisResult(await httpApi.analyzeIdea(ideaText));
            if (!result) {
                throw new Error('Invalid analysis payload');
            }
            setAnalysis(result);
            setWorkingDoc(result.structured_concept);
            setFeatureDecisions(buildFeatureDecisions(result));
            setHistory([
                {
                    role: 'assistant',
                    content:
                        'I analyzed the idea, built a structured concept, and queued the next features for review. Approve, reject, or rewrite them one by one.',
                },
            ]);
            setPhase('discussion');
        } catch (err: any) {
            setLastError(err?.message || 'Something went wrong while analyzing your idea.');
            setLastPhaseBeforeFailure('input');
            setPhase('failure');
        }
    };



    const sendDiscussionMessage = async (userMsg: string) => {
        if (!userMsg.trim() || isChatting) return;

        setHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
        setIsChatting(true);

        try {
            const contextMsg =
                'Project Idea:\n' +
                idea +
                '\n\nAnalysis JSON:\n' +
                JSON.stringify(analysis || {}, null, 2) +
                '\n\nFeature Decisions:\n' +
                JSON.stringify(
                    featureDecisions.map((feature) => ({
                        id: feature.id,
                        title: feature.title,
                        description: feature.description,
                        priority: feature.priority,
                        include: feature.include,
                        rating: feature.rating,
                        status: feature.status,
                        comment: feature.comment,
                    })),
                    null,
                    2
                ) +
                '\n\nUser request:\n' +
                userMsg;

            const workshopHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
            if (typeof window !== 'undefined') {
                const storedKey = localStorage.getItem('akasha_api_key')?.trim();
                const storedModel = localStorage.getItem('akasha_model')?.trim();
                const storedBase = localStorage.getItem('akasha_api_base_url')?.trim();
                const token = (localStorage.getItem("akasha_token") || localStorage.getItem("token"))?.trim();
                if (storedKey) workshopHeaders['x-ai-api-key'] = storedKey;
                if (storedModel) workshopHeaders['x-ai-model'] = storedModel;
                if (storedBase) workshopHeaders['x-ai-api-base-url'] = storedBase;
                if (token) workshopHeaders['Authorization'] = `Bearer ${token}`;
            }
            const res = await fetch('/api/akasha/ai/workshop-chat', {
                method: 'POST',
                headers: workshopHeaders,
                body: JSON.stringify({ message: contextMsg }),
            });

            const data = await res.json();
            if (res.ok) {
                const structured = normalizeAiResponse(data);
                setHistory((prev) => [...prev, { role: 'assistant', content: structured.answer_markdown, structured }]);

                // Apply structured changes from the AI response
                const changes = structured.feature_changes;
                if (changes && changes.length > 0) {
                    setFeatureDecisions((prev) => {
                        let updated = [...prev];
                        for (const change of changes) {
                            if (change._action === 'add') {
                                const newId = toFeatureDecisionId(change.title || 'New Feature', updated.length + 1);
                                updated.push({
                                    id: change.id || newId,
                                    title: change.title || 'New Feature',
                                    description: change.description || '',
                                    rationale: change.rationale || '',
                                    priority: (['critical', 'high', 'medium', 'low'].includes(String(change.priority)) ? String(change.priority) : 'medium') as FeaturePriority,
                                    include: change.include !== false,
                                    rating: (Number.isFinite(Number(change.rating)) ? Math.max(1, Math.min(5, Math.round(Number(change.rating)))) : 3) as 1 | 2 | 3 | 4 | 5,
                                    status: (['pending', 'approved', 'rejected'].includes(String(change.status)) ? String(change.status) : 'pending') as FeatureStatus,
                                    comment: change.comment || '',
                                    integratedSummary: change.integratedSummary || '',
                                    detailsRequested: false,
                                    clarifying_questions: Array.isArray(change.clarifying_questions) ? change.clarifying_questions.filter((q: any) => typeof q === 'string') : [],
                                });
                            } else if (change._action === 'update' && change.id) {
                                updated = updated.map((f) =>
                                    f.id === change.id
                                        ? {
                                            ...f,
                                            title: change.title ?? f.title,
                                            description: change.description ?? f.description,
                                            rationale: change.rationale ?? f.rationale,
                                            priority: change.priority && ['critical', 'high', 'medium', 'low'].includes(String(change.priority)) ? String(change.priority) as FeaturePriority : f.priority,
                                            include: change.include ?? f.include,
                                            rating: Number.isFinite(Number(change.rating)) ? Math.max(1, Math.min(5, Math.round(Number(change.rating)))) as 1 | 2 | 3 | 4 | 5 : f.rating,
                                            status: change.status && ['pending', 'approved', 'rejected'].includes(String(change.status)) ? String(change.status) as FeatureStatus : f.status,
                                            comment: change.comment ?? f.comment,
                                            integratedSummary: change.integratedSummary ?? f.integratedSummary,
                                        }
                                        : f
                                );
                            } else if (change._action === 'delete' && change.id) {
                                updated = updated.filter((f) => f.id !== change.id);
                            }
                        }
                        return updated;
                    });
                }

                const docChanges = structured.doc_changes;
                if (docChanges) {
                    setWorkingDoc((prev) => {
                        if (!prev) return prev;
                        const next = { ...prev };
                        for (const key of Object.keys(docChanges) as (keyof typeof docChanges)[]) {
                            const val = docChanges[key];
                            if (val !== undefined && val !== null) {
                                (next as any)[key] = val;
                            }
                        }
                        return next;
                    });

                    if (docChanges.strengths || docChanges.weaknesses) {
                        setAnalysis((prev) => {
                            if (!prev) return prev;
                            return {
                                ...prev,
                                strengths: docChanges.strengths ?? prev.strengths,
                                weaknesses: docChanges.weaknesses ?? prev.weaknesses,
                            };
                        });
                    }
                }
            } else {
                toast.showToast(data.error || 'Chat failed', 'error');
            }
        } catch (err: any) {
            toast.showToast('Chat failed: ' + err.message, 'error');
        } finally {
            setIsChatting(false);
        }
    };

    const handleSendChat = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const userMsg = chatInput.trim();
        if (!userMsg) return;
        setChatInput('');
        await sendDiscussionMessage(userMsg);
    };

    const handleQuickPrompt = async (prompt: string) => {
        await sendDiscussionMessage(prompt);
    };

    const setFeatureDecision = (featureId: string, updater: (feature: FeatureDecision) => FeatureDecision) => {
        setFeatureDecisions((prev) => prev.map((feature) => (feature.id === featureId ? updater(feature) : feature)));
    };

    const reviewCurrentFeature = async (action: 'revise' | 'approve' | 'reject', targetFeature?: FeatureDecision) => {
        const feature = targetFeature || activeFeature;
        if (!feature || isChatting) return;

        if (action === 'approve' || action === 'reject') {
            // OPTIZTOKEN: Handle approve/reject client-side instantly
            const nextStatus: FeatureStatus = action === 'approve' ? 'approved' : 'rejected';
            
            // 1. Update the feature queue
            setFeatureDecisions((prev) =>
                prev.map((f) =>
                    f.id === feature.id
                        ? {
                            ...f,
                            status: nextStatus,
                            include: action === 'approve',
                        }
                        : f
                )
            );

            // 2. Synchronize directly with workingDoc concept draft
            if (workingDoc) {
                const updatedFeatures = workingDoc.key_features.map((f) =>
                    f.feature === feature.title
                        ? { ...f, include: action === 'approve', rating: feature.rating, rationale: feature.description || feature.rationale || '' }
                        : f
                );
                const exists = workingDoc.key_features.some((f) => f.feature === feature.title);
                if (!exists && action === 'approve') {
                    updatedFeatures.push({
                        feature: feature.title,
                        include: true,
                        rating: feature.rating,
                        rationale: feature.description || feature.rationale || '',
                    });
                }
                setWorkingDoc({
                    ...workingDoc,
                    key_features: updatedFeatures,
                });
            }

            // Auto-select the next pending feature
            const nextPending = featureDecisions.find((f) => f.id !== feature.id && f.status === 'pending');
            if (nextPending) {
                setSelectedFeatureId(nextPending.id);
            } else {
                setSelectedFeatureId(null);
            }

            // Reset local answers for this feature
            setQuestionAnswers(prev => {
                const updated = { ...prev };
                delete updated[feature.id];
                return updated;
            });
            return;
        }

        // Action is 'revise'
        // Construct detailed feedback from AI questions and user answers
        const questionsList = feature.clarifying_questions || [];
        let qaText = '';
        if (questionsList.length > 0) {
            const featureAnswers = questionAnswers[feature.id] || {};
            const answeredQAs = questionsList.map((q, idx) => {
                const answer = featureAnswers[idx] || '';
                return `Q: ${q}\nA: ${answer || 'No answer provided.'}`;
            }).join('\n\n');
            qaText = `User answers to clarifying questions:\n${answeredQAs}`;
        }

        const customFeedback = feature.comment.trim();
        const combinedFeedback = [qaText, customFeedback ? `Additional feedback: ${customFeedback}` : ''].filter(Boolean).join('\n\n');

        if (!combinedFeedback.trim()) {
            toast.showToast('Please answer the questions or add custom feedback before asking the AI to rewrite.', 'warning');
            return;
        }

        setDetailsLoadingId(feature.id);
        setIsChatting(true);
        try {
            const response = await httpApi.reviewIdeaFeature({
                idea,
                action: 'revise',
                feature: {
                    ...feature,
                    user_comment: combinedFeedback,
                    integrated_summary: feature.integratedSummary,
                },
                feedback: combinedFeedback,
            });

            const reviewedFeature = buildFeatureDecisions({
                feature_queue: [response?.feature],
            })[0];

            if (reviewedFeature) {
                setFeatureDecisions((prev) =>
                    prev.map((f) =>
                        f.id === feature.id
                            ? {
                                ...f,
                                ...reviewedFeature,
                                include: true,
                                comment: '', // clear comments after revision
                                integratedSummary: reviewedFeature.integratedSummary,
                            }
                            : f
                    )
                );
                // Reset local answers for this feature
                setQuestionAnswers(prev => {
                    const updated = { ...prev };
                    delete updated[feature.id];
                    return updated;
                });
            }

            if (typeof response?.integration_note === 'string' && response.integration_note.trim()) {
                setHistory((prev) => [...prev, { role: 'assistant', content: response.integration_note.trim() }]);
            }
            toast.showToast('Feature rewritten successfully using your answers!', 'success');
        } catch (err: any) {
            toast.showToast(err?.message || 'Failed to rewrite feature', 'error');
        } finally {
            setDetailsLoadingId(null);
            setIsChatting(false);
        }
    };

    const handleAddFeature = () => {
        const title = newFeature.trim();
        if (!title) return;

        setFeatureDecisions((prev) => [
            ...prev,
            {
                id: toFeatureDecisionId(title, prev.length + 1),
                title,
                description: '',
                rationale: '',
                priority: 'medium',
                include: true,
                rating: 3 as const,
                status: 'pending',
                comment: '',
                integratedSummary: '',
                detailsRequested: false,
            },
        ]);
        setNewFeature('');
    };

    const handleRefine = async () => {
        if (!canDraftFinalDoc) {
            toast.showToast('Review the queued features first, then finalize the approved concept.', 'warning');
            return;
        }

        setPhase('refining');
        try {
            const decisionMatrix = featureDecisions.map((feature) => ({
                feature: feature.title,
                include: feature.include,
                rating: feature.rating,
                status: feature.status,
                priority: feature.priority,
                comment: feature.comment,
                description: feature.description,
                rationale: feature.rationale,
            }));

            const synthesisNotes = {
                selectedFeatureCount: selectedFeatures.length,
                averageRating,
                priorityFeatures: priorityFeatures.map((item) => item.title),
                analysisSummary: analysis?.summary || '',
            };

            const refinementHistory = [
                ...history,
                {
                    role: 'user' as const,
                    content:
                        'Decision matrix for final PRD (must be reflected in markdown tables):\n' +
                        JSON.stringify({ decisionMatrix, synthesisNotes }, null, 2),
                },
            ];

            const result = await httpApi.refineIdea(
                idea,
                refinementHistory,
                projectId,
                workingDoc,
                featureDecisions.map((feature) => ({
                    ...feature,
                    user_comment: feature.comment,
                    integrated_summary: feature.integratedSummary,
                })),
                analysis?.understanding
            );
            const normalizedDoc = normalizeRefinedDoc((result as any)?.doc);
            const fallbackMarkdown = typeof (result as any)?.refinedIdea === 'string' ? (result as any).refinedIdea : '';
            const finalMarkdown = normalizedDoc ? (fallbackMarkdown || docToMarkdown(normalizedDoc)) : fallbackMarkdown;

            if (normalizedDoc) {
                setRefinedDoc(normalizedDoc);
                setRefinedIdea(finalMarkdown);
            } else {
                setRefinedDoc(null);
                setRefinedIdea(finalMarkdown);
            }
            setPhase('complete');

            if (finalMarkdown.trim()) {
                setIsPersistingFinalPlan(true);
                await onRefined(finalMarkdown);
            }
        } catch (err: any) {
            setLastError(err?.message || 'Failed to refine the project concept. Please try again.');
            setLastPhaseBeforeFailure('discussion');
            setPhase('failure');
        } finally {
            setIsPersistingFinalPlan(false);
        }
    };

    const handleClearDiscussion = () => {
        setHistory([]);
        setChatInput('');
    };

    const handleUndoLast = () => {
        setHistory((prev) => prev.slice(0, -1));
    };

    const handleCopyMarkdown = async () => {
        if (!refinedIdea.trim()) return;
        try {
            await navigator.clipboard.writeText(refinedIdea);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            toast.showToast('Failed to copy markdown', 'error');
        }
    };

    const handleDownloadMarkdown = () => {
        if (!refinedIdea.trim()) return;
        const fileName = `${projectName || 'project'}-prd.md`
            .toLowerCase()
            .replace(/[^a-z0-9\-]+/g, '-')
            .replace(/-+/g, '-');
        const blob = new Blob([refinedIdea], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleCopyJson = async () => {
        const payload = refinedDoc || { markdown: refinedIdea };
        try {
            await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
            setJsonCopied(true);
            setTimeout(() => setJsonCopied(false), 1500);
        } catch {
            toast.showToast('Failed to copy JSON', 'error');
        }
    };

    const handleDownloadJson = () => {
        const payload = refinedDoc || { markdown: refinedIdea };
        const fileName = `${projectName || 'project'}-prd.json`
            .toLowerCase()
            .replace(/[^a-z0-9\-]+/g, '-')
            .replace(/-+/g, '-');
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderChatPanel = () => (
        <div className="flex-1 min-h-0 flex flex-col bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl overflow-hidden shadow-inner">
            <div className="bg-black/20 px-4 py-2 border-b border-[var(--ide-border)] flex items-center justify-between">
                <span className="text-[10px] font-black text-[var(--ide-text-muted)] uppercase tracking-widest">Discussion</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleUndoLast}
                        disabled={history.length === 0}
                        className="h-7 px-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40 transition-all"
                    >
                        Undo
                    </button>
                    <button
                        onClick={handleClearDiscussion}
                        disabled={history.length === 0 && !chatInput.trim()}
                        className="h-7 px-2 rounded-lg text-[10px] font-bold bg-white/5 border border-white/10 text-white/60 hover:text-white disabled:opacity-40 transition-all"
                    >
                        Clear
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {history.length === 0 && !isChatting && (
                    <div className="h-full flex items-center justify-center text-center text-white/40 text-sm">
                        Start by asking for scope, architecture, pricing, go-to-market, or risk reduction.
                    </div>
                )}

                {history.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[92%] rounded-2xl px-4 py-3 ${
                                msg.role === 'user'
                                    ? 'bg-white/10 text-white border border-white/20 rounded-tr-sm'
                                    : 'bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] text-gray-300 rounded-tl-sm shadow-sm'
                            } ${fullScreen ? 'text-base leading-relaxed' : 'text-sm'}`}
                        >
                            {msg.role === 'assistant' && msg.structured ? (
                                <StructuredAiResponseCard response={msg.structured} compact={!fullScreen} />
                            ) : (
                                <div
                                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content, { async: false }) as string }}
                                    className="prose prose-invert prose-sm max-w-none"
                                />
                            )}
                        </div>
                    </div>
                ))}

                {isChatting && (
                    <div className="flex justify-start">
                        <div className="bg-[var(--ide-bg-panel)] border border-[var(--ide-border)] rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex gap-1 items-center">
                            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            <div className="px-3 py-2 border-t border-[var(--ide-border)] bg-black/10 flex flex-wrap gap-2">
                {QUICK_PROMPTS.slice(0, fullScreen ? 6 : 3).map((prompt) => (
                    <button
                        key={prompt}
                        onClick={() => handleQuickPrompt(prompt)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-white/5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white transition-all"
                    >
                        {prompt}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSendChat} className="p-3 bg-black/20 border-t border-[var(--ide-border)] flex gap-3">
                <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask AI to improve scope, product strategy, architecture, or go-to-market..."
                    className={`flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none px-2 ${
                        fullScreen ? 'text-base py-1.5' : 'text-sm'
                    }`}
                />
                <button
                    type="submit"
                    disabled={!chatInput.trim() || isChatting}
                    className={`bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 border border-white/10 disabled:opacity-50 transition-all ${
                        fullScreen ? 'h-10 px-5 text-sm' : 'h-8 px-4 text-xs'
                    }`}
                >
                    Send
                </button>
            </form>
        </div>
    );

    const renderFeatureDecisionBoard = () => {
        const reviewedCount = featureDecisions.filter((feature) => feature.status !== 'pending').length;
        const totalCount = featureDecisions.length;

        return (
            <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-4 mb-6 shrink-0">
                    <div>
                        <div className="text-xs font-black text-white/60 uppercase tracking-widest">
                            Requirement Review ({reviewedCount}/{totalCount} Completed)
                        </div>
                        <p className="text-[11px] text-white/35 mt-1">
                            Review and finalize each feature. Approve, reject, or rewrite requirements using AI feedback.
                        </p>
                    </div>
                </div>

                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 overflow-hidden">
                    {/* Left Sidebar: Feature queue list & operations */}
                    <div className="flex flex-col gap-4 overflow-hidden border-r border-white/5 lg:pr-6">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/45 pl-1 shrink-0">
                            Features Queue
                        </div>

                        {/* Scrollable features list */}
                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                            {featureDecisions.length === 0 ? (
                                <div className="text-xs text-white/30 italic p-4 text-center">
                                    No features in queue.
                                </div>
                            ) : (
                                featureDecisions.map((feature) => {
                                    const isActive = activeFeature?.id === feature.id;
                                    const isApproved = feature.status === 'approved';
                                    const isRejected = feature.status === 'rejected';
                                    const isRewriting = detailsLoadingId === feature.id;

                                    let statusBg = 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10';
                                    if (isActive) {
                                        statusBg = 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300';
                                    } else if (isApproved) {
                                        statusBg = 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/20 text-emerald-300/80';
                                    } else if (isRejected) {
                                        statusBg = 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/20 text-rose-300/60 line-through opacity-70';
                                    }

                                    return (
                                        <button
                                            key={feature.id}
                                            type="button"
                                            onClick={() => setSelectedFeatureId(feature.id)}
                                            className={`w-full p-3 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer ${statusBg}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="text-xs font-bold leading-snug truncate max-w-[170px]">
                                                    {feature.title}
                                                </span>
                                                <div className="flex-shrink-0 flex items-center justify-center">
                                                    {isRewriting ? (
                                                        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                                                    ) : isApproved ? (
                                                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[9px] font-black">✓</span>
                                                    ) : isRejected ? (
                                                        <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center text-[9px] font-black">✗</span>
                                                    ) : (
                                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${getPriorityStyle(feature.priority)}`}>
                                                    {feature.priority}
                                                </span>
                                                <span className="text-[9px] text-white/30">
                                                    Rating: {feature.rating}/5
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Add custom feature inline block */}
                        <div className="space-y-2 pt-3 border-t border-white/5 shrink-0">
                            <input
                                type="text"
                                value={newFeature}
                                onChange={(e) => setNewFeature(e.target.value)}
                                placeholder="Add custom feature..."
                                className="w-full h-9 rounded-xl bg-black/40 border border-white/10 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                            />
                            <button
                                onClick={handleAddFeature}
                                type="button"
                                className="w-full h-9 rounded-xl text-[10px] font-bold uppercase bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-1"
                            >
                                + Add Custom
                            </button>
                        </div>

                        {/* Confirm/Draft PRD block */}
                        <div className="shrink-0 pt-2">
                            <button
                                onClick={handleRefine}
                                disabled={!canDraftFinalDoc}
                                className="w-full h-11 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:pointer-events-none transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                            >
                                Draft Final PRD
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Selected Feature Form */}
                    <div className="flex flex-col min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                        {!activeFeature ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-white/[0.01] border border-white/5 rounded-3xl">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                                    <span className="text-2xl text-emerald-400">✓</span>
                                </div>
                                <h3 className="text-lg font-black text-white">All Requirements Reviewed!</h3>
                                <p className="text-xs text-white/40 mt-2 max-w-sm">
                                    You have made decisions on all {totalCount} features. Click "Draft Final PRD" on the left sidebar to generate the document, or click a feature to review its settings again.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-5 pb-4">
                                <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
                                    <div className="w-full">
                                        <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                                            Active Feature
                                            <span className={`inline-flex px-1.5 py-0.5 rounded border text-[8px] uppercase ${getPriorityStyle(activeFeature.priority)}`}>
                                                {activeFeature.priority}
                                            </span>
                                            {activeFeature.status !== 'pending' && (
                                                <span className={`inline-flex px-1.5 py-0.5 rounded border text-[8px] uppercase ${activeFeature.status === 'approved' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'}`}>
                                                    {activeFeature.status}
                                                </span>
                                            )}
                                        </div>
                                        <input
                                            type="text"
                                            value={activeFeature.title}
                                            onChange={(e) => setFeatureDecision(activeFeature.id, (f) => ({ ...f, title: e.target.value }))}
                                            placeholder="Feature title..."
                                            className="w-full bg-transparent border-0 text-xl font-black text-white leading-tight mt-1 focus:outline-none focus:ring-0 p-0"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 pl-1">Description</label>
                                    <textarea
                                        value={activeFeature.description}
                                        onChange={(e) => setFeatureDecision(activeFeature.id, (f) => ({ ...f, description: e.target.value }))}
                                        placeholder="What does this feature do?"
                                        rows={3}
                                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-white/20 resize-none font-sans"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 pl-1">Rationale / Why it matters</label>
                                    <textarea
                                        value={activeFeature.rationale}
                                        onChange={(e) => setFeatureDecision(activeFeature.id, (f) => ({ ...f, rationale: e.target.value }))}
                                        placeholder="Why is this feature important?"
                                        rows={2}
                                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-white/20 resize-none font-sans"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 pl-1">Priority Override</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(['critical', 'high', 'medium', 'low'] as FeaturePriority[]).map((level) => (
                                                <button
                                                    key={`${activeFeature.id}-priority-${level}`}
                                                    type="button"
                                                    onClick={() => setFeatureDecision(activeFeature.id, (f) => ({ ...f, priority: level }))}
                                                    className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-wider transition-all ${
                                                        activeFeature.priority === level
                                                            ? getPriorityStyle(level)
                                                            : 'border-white/10 bg-black/40 text-white/40 hover:text-white/60 hover:bg-white/5'
                                                    }`}
                                                >
                                                    {level}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-white/40 pl-1">Implementation Rating (1-5)</label>
                                        <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((level) => (
                                                <button
                                                    key={`${activeFeature.id}-rating-${level}`}
                                                    type="button"
                                                    onClick={() => setFeatureDecision(activeFeature.id, (f) => ({ ...f, rating: level as 1 | 2 | 3 | 4 | 5 }))}
                                                    className={`h-7 w-7 rounded-lg border text-xs font-black transition-all ${
                                                        activeFeature.rating === level
                                                            ? getRatingStyle(level)
                                                            : 'border-white/10 bg-black/40 text-white/40 hover:text-white/60 hover:bg-white/5'
                                                    }`}
                                                >
                                                    {level}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {activeFeature.clarifying_questions && activeFeature.clarifying_questions.length > 0 && (
                                    <div className="space-y-3 p-4 rounded-2xl border border-white/5 bg-black/40">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 pl-1">Clarifying Questions</div>
                                        <div className="space-y-4">
                                            {activeFeature.clarifying_questions.map((q, idx) => {
                                                const answers = questionAnswers[activeFeature.id] || {};
                                                const val = answers[idx] || '';
                                                return (
                                                    <div key={idx} className="space-y-2 border-b border-white/5 last:border-b-0 pb-3 last:pb-0">
                                                        <label className="text-xs font-bold text-white/85 leading-relaxed block">Q{idx + 1}: {q}</label>
                                                        <input
                                                            type="text"
                                                            value={val}
                                                            onChange={(e) => setQuestionAnswers(prev => ({
                                                                ...prev,
                                                                [activeFeature.id]: {
                                                                    ...(prev[activeFeature.id] || {}),
                                                                    [idx]: e.target.value
                                                                }
                                                            }))}
                                                            placeholder="Your answer..."
                                                            className="w-full h-8 rounded-lg bg-black/60 border border-white/10 px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                                                        />
                                                        <div className="flex flex-wrap gap-1">
                                                            {['Yes', 'No', 'Not sure', 'Standard approach', 'Needs research', 'Custom design'].map((pill) => (
                                                                <button
                                                                    key={pill}
                                                                    type="button"
                                                                    onClick={() => setQuestionAnswers(prev => ({
                                                                        ...prev,
                                                                        [activeFeature.id]: {
                                                                            ...(prev[activeFeature.id] || {}),
                                                                            [idx]: pill
                                                                        }
                                                                    }))}
                                                                    className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] uppercase font-bold text-white/50 hover:text-white hover:bg-white/10 transition-all"
                                                                >
                                                                    {pill}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 pl-1">Final Feedback / Revision Notes</label>
                                    <textarea
                                        value={activeFeature.comment}
                                        onChange={(e) => setFeatureDecision(activeFeature.id, (f) => ({ ...f, comment: e.target.value }))}
                                        placeholder="Type any specific changes you want the AI to make when rewriting, or general thoughts..."
                                        rows={3}
                                        className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-white/20 resize-none font-sans"
                                    />
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-end gap-3 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => reviewCurrentFeature('reject')}
                                        disabled={isChatting || detailsLoadingId === activeFeature.id}
                                        className="h-10 px-4 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 disabled:opacity-50 transition-all"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => reviewCurrentFeature('revise')}
                                        disabled={isChatting || detailsLoadingId === activeFeature.id}
                                        className="h-10 px-5 rounded-xl text-xs font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 disabled:opacity-50 transition-all flex items-center gap-1.5"
                                    >
                                        {detailsLoadingId === activeFeature.id ? (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce" />
                                                Rewriting...
                                            </>
                                        ) : (
                                            'Revise with AI'
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => reviewCurrentFeature('approve')}
                                        disabled={isChatting || detailsLoadingId === activeFeature.id}
                                        className="h-10 px-5 rounded-xl text-xs font-black bg-white text-black hover:bg-white/90 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderRefinedDoc = () => {
        if (!refinedDoc) return null;

        const infoCard = (title: string, value: string | number) => (
            <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                <div className="text-white/50 text-[11px]">{title}</div>
                <div className="text-lg font-black text-white mt-1">{value}</div>
            </div>
        );

        const listCard = (title: string, items: string[], tone: 'cyan' | 'emerald' | 'amber') => {
            const toneClasses = {
                cyan: 'bg-white/5 border-white/10 text-white/60',
                emerald: 'bg-white/5 border-white/10 text-white/60',
                amber: 'bg-white/5 border-white/10 text-white/60',
            };

            return (
                <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
                    <div className="text-[11px] font-black uppercase tracking-widest mb-2">{title}</div>
                    <ul className="space-y-1 text-xs">
                        {items.length > 0
                            ? items.map((item, index) => <li key={`${title}-${index}`}>• {item}</li>)
                            : <li>• N/A</li>}
                    </ul>
                </div>
            );
        };

        return (
            <div className="space-y-4">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/40">JSON PRD</div>
                    <h3 className="mt-1 text-xl font-black text-white">{refinedDoc.title}</h3>
                    <p className="mt-2 text-sm text-white/75 leading-relaxed">{refinedDoc.summary || 'No summary generated.'}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {infoCard('Features', refinedDoc.key_features.length)}
                    {infoCard('Milestones', refinedDoc.milestones.length)}
                    {infoCard('Risks', refinedDoc.risks.length)}
                </div>

                <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--ide-border)] text-xs font-black uppercase tracking-widest text-[var(--ide-text-secondary)]">
                        Key Features (JSON)
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[680px]">
                            <thead className="bg-black/20">
                                <tr>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Feature</th>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Include</th>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Rating</th>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Rationale</th>
                                </tr>
                            </thead>
                            <tbody>
                                {refinedDoc.key_features.length > 0 ? refinedDoc.key_features.map((row, index) => (
                                    <tr key={`feature-${index}`} className="border-t border-white/5">
                                        <td className="px-3 py-2 text-white/85">{row.feature}</td>
                                        <td className="px-3 py-2 text-white/70">{row.include ? 'Yes' : 'No'}</td>
                                        <td className="px-3 py-2 text-white/70">{row.rating}/5</td>
                                        <td className="px-3 py-2 text-white/70">{row.rationale || '-'}</td>
                                    </tr>
                                )) : (
                                    <tr className="border-t border-white/5">
                                        <td className="px-3 py-2 text-white/50" colSpan={4}>No feature rows.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--ide-border)] text-xs font-black uppercase tracking-widest text-[var(--ide-text-secondary)]">
                            Milestones (JSON)
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[520px]">
                                <thead className="bg-black/20">
                                    <tr>
                                        <th className="text-left px-3 py-2 text-white/60 font-bold">Milestone</th>
                                        <th className="text-left px-3 py-2 text-white/60 font-bold">Owner</th>
                                        <th className="text-left px-3 py-2 text-white/60 font-bold">ETA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {refinedDoc.milestones.length > 0 ? refinedDoc.milestones.map((row, index) => (
                                        <tr key={`milestone-${index}`} className="border-t border-white/5">
                                            <td className="px-3 py-2 text-white/85">{row.milestone}</td>
                                            <td className="px-3 py-2 text-white/70">{row.owner_role || '-'}</td>
                                            <td className="px-3 py-2 text-white/70">{row.eta || '-'}</td>
                                        </tr>
                                    )) : (
                                        <tr className="border-t border-white/5">
                                            <td className="px-3 py-2 text-white/50" colSpan={3}>No milestone rows.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-[var(--ide-border)] text-xs font-black uppercase tracking-widest text-[var(--ide-text-secondary)]">
                            Risks (JSON)
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs min-w-[520px]">
                                <thead className="bg-black/20">
                                    <tr>
                                        <th className="text-left px-3 py-2 text-white/60 font-bold">Risk</th>
                                        <th className="text-left px-3 py-2 text-white/60 font-bold">Impact</th>
                                        <th className="text-left px-3 py-2 text-white/60 font-bold">Mitigation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {refinedDoc.risks.length > 0 ? refinedDoc.risks.map((row, index) => (
                                        <tr key={`risk-${index}`} className="border-t border-white/5">
                                            <td className="px-3 py-2 text-white/85">{row.risk}</td>
                                            <td className="px-3 py-2 text-white/70">{row.impact || '-'}</td>
                                            <td className="px-3 py-2 text-white/70">{row.mitigation || '-'}</td>
                                        </tr>
                                    )) : (
                                        <tr className="border-t border-white/5">
                                            <td className="px-3 py-2 text-white/50" colSpan={3}>No risk rows.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {listCard('Target Audience', refinedDoc.target_audience, 'cyan')}
                    {listCard('User Flows', refinedDoc.user_flows, 'emerald')}
                    {listCard('Success Metrics', refinedDoc.success_metrics, 'amber')}
                    {listCard('Architecture', refinedDoc.technical_architecture, 'cyan')}
                    {listCard('Checklist', refinedDoc.implementation_checklist, 'emerald')}
                    {listCard('Open Questions', refinedDoc.open_questions, 'amber')}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-2">Raw JSON</div>
                    <pre className="text-[11px] leading-relaxed text-white/75 overflow-x-auto custom-scrollbar">
                        {JSON.stringify(refinedDoc, null, 2)}
                    </pre>
                </div>
            </div>
        );
    };

    const renderDecisionTables = () => {
        const high = selectedFeatures.filter((item) => item.rating >= 4);
        const medium = selectedFeatures.filter((item) => item.rating === 3);
        const low = selectedFeatures.filter((item) => item.rating <= 2);

        return (
            <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <div className="text-xs font-black text-white/60 uppercase tracking-widest mb-2">Decision Snapshot</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                            <div className="text-white/50">Selected Features</div>
                            <div className="text-lg font-black text-white mt-1">{selectedFeatures.length}</div>
                        </div>
                        <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                            <div className="text-white/50">Average Priority</div>
                            <div className="text-lg font-black text-white mt-1">{averageRating || 0}/5</div>
                        </div>
                        <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                            <div className="text-white/50">High Priority</div>
                            <div className="text-lg font-black text-white mt-1">{priorityFeatures.length}</div>
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--ide-border)] text-xs font-black uppercase tracking-widest text-[var(--ide-text-secondary)]">
                        Feature Decision Table
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs min-w-[640px]">
                            <thead className="bg-black/20">
                                <tr>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Feature</th>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Include</th>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Rating</th>
                                    <th className="text-left px-3 py-2 text-white/60 font-bold">Comment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {featureDecisions.map((feature) => (
                                    <tr key={`table-${feature.id}`} className="border-t border-white/5">
                                        <td className="px-3 py-2 text-white/85">{feature.title}</td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${feature.include ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-white/30'}`}>
                                                {feature.include ? 'Yes' : 'No'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${getRatingStyle(feature.rating)}`}>
                                                {feature.rating}/5
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-white/70">{feature.comment || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--ide-border)] text-xs font-black uppercase tracking-widest text-[var(--ide-text-secondary)]">
                        Priority Breakdown
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
                        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                            <div className="text-[11px] font-black text-white/70 uppercase tracking-wide">High (4-5)</div>
                            <ul className="mt-2 space-y-1 text-xs text-white/60">
                                {high.length > 0 ? high.map((item) => <li key={`high-${item.id}`}>• {item.title}</li>) : <li>• None</li>}
                            </ul>
                        </div>
                        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                            <div className="text-[11px] font-black text-white/70 uppercase tracking-wide">Medium (3)</div>
                            <ul className="mt-2 space-y-1 text-xs text-white/60">
                                {medium.length > 0 ? medium.map((item) => <li key={`medium-${item.id}`}>• {item.title}</li>) : <li>• None</li>}
                            </ul>
                        </div>
                        <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                            <div className="text-[11px] font-black text-white/70 uppercase tracking-wide">Low (1-2)</div>
                            <ul className="mt-2 space-y-1 text-xs text-white/60">
                                {low.length > 0 ? low.map((item) => <li key={`low-${item.id}`}>• {item.title}</li>) : <li>• None</li>}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-2">Open Questions</div>
                        <ul className="space-y-1 text-xs text-white/60">
                            {((analysis?.questions as string[] | undefined) || []).length > 0
                                ? ((analysis?.questions as string[] | undefined) || []).map((item: string, index: number) => (
                                    <li key={`question-${index}`}>• {item}</li>
                                ))
                                : <li>• No open questions captured.</li>}
                        </ul>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-[11px] font-black text-white/70 uppercase tracking-widest mb-2">Idea Improvement Focus</div>
                        <ul className="space-y-1 text-xs text-white/60">
                            {((analysis?.suggestions as string[] | undefined) || []).length > 0
                                ? ((analysis?.suggestions as string[] | undefined) || []).map((item: string, index: number) => (
                                    <li key={`suggestion-${index}`}>• {item}</li>
                                ))
                                : <li>• No suggestions captured.</li>}
                        </ul>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className={`w-full flex flex-col bg-[#050508] text-white overflow-hidden relative ${
                fullScreen
                    ? 'h-full rounded-none border-0 shadow-none'
                    : 'max-w-4xl mx-auto h-[80vh] rounded-3xl border border-[var(--ide-border-strong)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-slide-up'
            }`}
        >
            <div className="flex-shrink-0 border-b border-[var(--ide-border)] bg-gradient-to-b from-white/[0.03] to-transparent">
                <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center shadow-lg border border-white/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-black text-[var(--ide-text)]">AI Idea Workshop</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-[var(--ide-text-secondary)] uppercase tracking-widest font-black">Project:</span>
                                <span className="text-xs text-white/60 font-bold">{projectName}</span>
                            </div>
                        </div>
                    </div>

                    {phase !== 'analyzing' && phase !== 'refining' && (
                        <button
                            onClick={onCancel}
                            className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--ide-text-muted)] hover:text-white transition-all text-xs font-bold"
                        >
                            {fullScreen ? 'Back' : '✕'}
                        </button>
                    )}
                </div>

                <div className="px-5 pb-4">
                    <div className="grid grid-cols-4 gap-2">
                        {WORKFLOW_STEPS.map((step, index) => {
                            const stepNumber = index + 1;
                            const isActive = stepNumber === activeStep;
                            const isDone = stepNumber < activeStep;

                            return (
                                <div
                                    key={step}
                                    className={`rounded-xl border px-3 py-2 text-xs transition-all flex flex-col justify-center min-h-[48px] ${
                                        isActive
                                            ? 'border-white/40 bg-white/10 text-white'
                                            : isDone
                                                ? 'border-white/20 bg-white/5 text-white/60'
                                                : 'border-white/10 bg-white/[0.02] text-white/35'
                                    }`}
                                >
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Step {stepNumber}</div>
                                    <div className="mt-1 font-semibold">{step}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className={`flex-1 min-h-0 ${fullScreen ? 'p-4 md:p-5 overflow-y-auto custom-scrollbar' : 'p-6 overflow-y-auto custom-scrollbar'}`}>
                {phase === 'input' && (
                    <div
                        className={`h-full min-h-0 grid gap-4 animate-fade-in ${
                            fullScreen ? 'xl:grid-cols-[320px,1fr]' : 'grid-cols-1'
                        }`}
                    >
                        <div className="space-y-4 min-w-0">
                            <div className="rounded-2xl border border-white/20 bg-white/5 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Idea Readiness</div>
                                <div className="mt-2 flex items-end justify-between">
                                    <div className="text-3xl font-black text-white">{ideaReadinessScore}%</div>
                                    <div className="text-[11px] text-white/45">{ideaWordCount} words</div>
                                </div>
                                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-white/20 via-white/40 to-white/60 transition-all duration-300"
                                        style={{ width: `${ideaReadinessScore}%` }}
                                    />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Checklist</div>
                                <ul className="mt-3 space-y-2">
                                    {readinessChecks.map((check) => (
                                        <li key={check.id} className="flex items-center gap-2 text-xs">
                                            <span
                                                className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black ${
                                                    check.done
                                                        ? 'bg-white/20 text-white border border-white/40'
                                                        : 'bg-white/8 text-white/45 border border-white/15'
                                                }`}
                                            >
                                                {check.done ? '✓' : '•'}
                                            </span>
                                            <span className={check.done ? 'text-white/85' : 'text-white/35'}>{check.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="rounded-2xl border border-white/15 bg-white/5 p-4 space-y-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-white/60">Templates</div>
                                    <p className="mt-1 text-[11px] text-white/40">Kickstart with guided sections or a starter JSON brief.</p>
                                </div>
                                <button
                                    onClick={applyFullTemplate}
                                    type="button"
                                    className="w-full h-9 rounded-xl text-xs font-bold bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all"
                                >
                                    Insert Full Template
                                </button>
                                <button
                                    onClick={applySampleJsonTemplate}
                                    type="button"
                                    className="w-full h-9 rounded-xl text-xs font-bold bg-white/8 border border-white/15 text-white/80 hover:bg-white/12 transition-all"
                                >
                                    Insert Sample JSON
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 min-w-0 flex flex-col gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-start gap-4">
                                <div className="text-sm text-white/70">
                                    <strong className="block text-white mb-1">Write with structure, then let AI sharpen it.</strong>
                                    Include problem, user, value, MVP scope, and constraints. Plain text or JSON both work here. Better input gives stronger analysis and better final docs.
                                </div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                                <div className="flex flex-wrap gap-2">
                                    {IDEA_SECTION_TEMPLATES.map((template) => (
                                        <button
                                            key={template.id}
                                            type="button"
                                            onClick={() => applySectionTemplate(template.id)}
                                            className="h-8 px-3 rounded-lg text-[11px] font-bold bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                                        >
                                            + {template.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 overflow-hidden bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl p-2 md:p-3 shadow-inner">
                                <textarea
                                    value={idea}
                                    onChange={(e) => setIdea(e.target.value)}
                                    placeholder="Describe the problem, users, value proposition, and must-have features..."
                                    className="block w-full h-full min-h-[280px] box-border bg-transparent rounded-xl p-3 md:p-4 text-[var(--ide-text)] text-sm leading-relaxed focus:outline-none focus:border-white/20 transition-all resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[var(--ide-text-muted)] font-medium px-1">
                                <span>{ideaWordCount} words</span>
                                <span>{idea.trim().length} characters</span>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'failure' && (
                    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050508]/95 backdrop-blur-md animate-fade-in">
                        <div className="pointer-events-none absolute inset-0">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-red-600/8 blur-[140px]" />
                        </div>
                        <div className="relative flex flex-col items-center gap-6 max-w-md text-center px-6">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-black tracking-tight text-white">
                                    {lastPhaseBeforeFailure === 'discussion' ? 'Refinement Failed' : 'Analysis Failed'}
                                </h2>
                                <p className="text-sm text-white/50 leading-relaxed">{lastError}</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setPhase(lastPhaseBeforeFailure)}
                                    className="px-5 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm font-medium"
                                >
                                    Go Back
                                </button>
                                <button
                                    onClick={() => lastPhaseBeforeFailure === 'discussion' ? handleRefine() : runAnalyze()}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all text-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Retry
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {(phase === 'analyzing' || phase === 'refining') && (
                    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050508]/95 backdrop-blur-md animate-fade-in">
                        <div className="pointer-events-none absolute inset-0">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-indigo-600/8 blur-[140px]" />
                        </div>
                        <div className="relative flex flex-col items-center gap-8 max-w-lg text-center px-6">
                            <div className="relative w-20 h-20">
                                <div className="absolute inset-0 rounded-full border-2 border-white/8" />
                                <div className="absolute inset-0 rounded-full border-t-2 border-indigo-400 animate-spin" />
                                <div className="absolute inset-2 rounded-full border-t border-violet-300/60 animate-spin" style={{ animationDuration: "1.5s" }} />
                            </div>

                            <div className="space-y-1.5 w-full">
                                {[
                                    { key: "analyze", label: phase === 'analyzing' ? "Understanding idea..." : "Generating markdown..." },
                                    { key: "concept", label: phase === 'analyzing' ? "Structuring concept..." : "Organizing features..." },
                                    { key: "queue",   label: phase === 'analyzing' ? "Queuing feature decisions..." : "Finalizing PRD..." },
                                ].map(({ key, label }, index) => {
                                    // Make progress based on some mock state, or just show them all spinning for now
                                    // For visual polish we will just show them pulsing if active
                                    const isDone = false;
                                    const isActive = true;
                                    
                                    return (
                                        <div key={key} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
                                            isActive ? "bg-white/8 border border-white/12" : "opacity-40"
                                        }`}>
                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                                                isDone ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/30" :
                                                isActive ? "bg-indigo-500/30 text-indigo-300 border border-indigo-400/30" :
                                                "bg-white/5 border border-white/10 text-white/20"
                                            }`}>
                                                {isDone ? "✓" : index + 1}
                                            </div>
                                            <span className={`text-sm font-medium ${
                                                isActive ? "text-white" : isDone ? "text-white/60" : "text-white/20"
                                            }`}>{label}</span>
                                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Phase Transition</p>
                                <h2 className="text-xl font-black tracking-tight text-white">
                                    {phase === 'analyzing' ? 'Building the project concept...' : 'Polishing the final PRD...'}
                                </h2>
                                <p className="text-sm text-white/40">
                                    {phase === 'analyzing'
                                        ? 'Understanding the idea first, then filling the concept sections.'
                                        : 'Converting the approved concept into the final structured output.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'discussion' && analysis && (
                    <div className="h-full min-h-0 animate-fade-in flex flex-col gap-4">
                        <div className="flex-shrink-0 min-h-0 overflow-y-auto custom-scrollbar">
                            {renderFeatureDecisionBoard()}
                        </div>

                        <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr,1.2fr] gap-4 overflow-hidden">
                            <div className="min-h-0 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                <div className="rounded-2xl border border-white/10 bg-[var(--ide-bg-elevated)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                    <div className="text-xs font-black text-white/70 uppercase tracking-widest mb-3">Project Concept</div>
                                    {workingDoc?.summary && (
                                        <p className="text-sm text-white/80 leading-relaxed mb-4 italic">
                                            "{workingDoc.summary}"
                                        </p>
                                    )}
                                    {workingDoc?.target_audience && workingDoc.target_audience.length > 0 && (
                                        <div className="mb-3">
                                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">Target Audience</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {workingDoc.target_audience.map((item, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white/70">{item}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {workingDoc?.core_value_proposition && workingDoc.core_value_proposition.length > 0 && (
                                        <div className="mb-3">
                                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">Value Proposition</div>
                                            <ul className="space-y-1">
                                                {workingDoc.core_value_proposition.map((item, i) => (
                                                    <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                                                        <span className="text-white/30 mt-0.5">•</span>{item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {analysis.strengths && analysis.strengths.length > 0 && (
                                        <div className="mb-3">
                                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">Strengths</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {analysis.strengths.map((s, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300/80">{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                                        <div>
                                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5">Risks</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {analysis.weaknesses.map((w, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300/80">{w}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {workingDoc?.technical_architecture && workingDoc.technical_architecture.length > 0 && (
                                    <div className="rounded-2xl border border-white/10 bg-[var(--ide-bg-elevated)] p-4">
                                        <div className="text-xs font-black text-white/70 uppercase tracking-widest mb-3">Technical Architecture</div>
                                        <ul className="space-y-1.5">
                                            {workingDoc.technical_architecture.map((item, i) => (
                                                <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                                                    <span className="text-white/30 mt-0.5">•</span>{item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {workingDoc?.milestones && workingDoc.milestones.length > 0 && (
                                    <div className="rounded-2xl border border-white/10 bg-[var(--ide-bg-elevated)] p-4">
                                        <div className="text-xs font-black text-white/70 uppercase tracking-widest mb-3">Milestones</div>
                                        <div className="space-y-2">
                                            {workingDoc.milestones.map((m, i) => (
                                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3">
                                                    <div className="text-sm font-bold text-white">{m.milestone}</div>
                                                    <div className="text-[11px] text-white/50 mt-0.5">{m.scope}</div>
                                                    {m.owner_role && <div className="text-[10px] text-white/30 mt-1">Owner: {m.owner_role}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {analysis.questions && analysis.questions.length > 0 && (
                                    <div className="rounded-2xl border border-white/10 bg-[var(--ide-bg-elevated)] p-4">
                                        <div className="text-xs font-black text-white/70 uppercase tracking-widest mb-3">Questions to Consider</div>
                                        <div className="flex flex-wrap gap-2">
                                            {(analysis.questions || []).map((q: string, i: number) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleQuickPrompt(q)}
                                                    className="px-2.5 py-1 bg-white/10 text-white/70 text-[11px] rounded-lg border border-white/15 hover:bg-white/20 transition-all"
                                                >
                                                    {q}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="min-h-0 flex flex-col">
                                {renderChatPanel()}
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'complete' && (
                    <div className="h-full flex flex-col space-y-4 animate-fade-in">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">✓</div>
                                <div>
                                    <div className="text-sm font-bold text-emerald-400">Draft Complete</div>
                                    <div className="text-xs text-emerald-500/70">Feature decisions confirmed and applied.</div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                            {renderDecisionTables()}
                            {renderRefinedDoc()}

                            {refinedIdea.trim() && (
                                <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl p-6 shadow-inner">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-[var(--ide-text-secondary)] mb-3">Markdown Fallback</div>
                                    <div
                                        className="prose prose-invert prose-indigo max-w-none"
                                        dangerouslySetInnerHTML={{ __html: marked.parse(refinedIdea, { async: false }) as string }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className={`flex-shrink-0 p-4 border-t border-[var(--ide-border)] bg-black/20 flex gap-3 ${fullScreen ? 'justify-between' : 'justify-end'} ${fullScreen ? '' : 'rounded-b-3xl'}`}>
                <div className="flex items-center gap-2">
                    {phase === 'discussion' && (
                        <button
                            onClick={() => runAnalyze()}
                            className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                        >
                            Re-analyze
                        </button>
                    )}

                    {phase === 'complete' && (
                        <>
                            <button
                                onClick={handleCopyJson}
                                className="h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                            >
                                {jsonCopied ? 'JSON Copied' : 'Copy JSON'}
                            </button>
                            <button
                                onClick={handleDownloadJson}
                                className="h-10 px-4 rounded-xl border border-white/20 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                            >
                                Download .json
                            </button>
                            <button
                                onClick={handleCopyMarkdown}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                            >
                                {copied ? 'Copied' : 'Copy Markdown'}
                            </button>
                            <button
                                onClick={handleDownloadMarkdown}
                                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                            >
                                Download .md
                            </button>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {phase === 'input' && (
                        <button
                            onClick={() => runAnalyze()}
                            disabled={!idea.trim()}
                            className="btn-modern-primary !h-10 !px-8 text-xs disabled:opacity-50"
                        >
                            Analyze Idea
                        </button>
                    )}

                    {phase === 'discussion' && (
                        <button
                            onClick={handleRefine}
                            disabled={!canDraftFinalDoc}
                            className="btn-modern-primary !h-10 !px-8 text-xs !bg-white/10 !text-white hover:!bg-white/20 !border-white/20 disabled:opacity-50"
                            title={!canDraftFinalDoc ? 'Finish reviewing the queued features before finalizing the document.' : ''}
                        >
                            Confirm & Draft Final Document
                        </button>
                    )}

                    {phase === 'complete' && (
                        <button
                            onClick={() => onRefined(refinedIdea)}
                            disabled={isPersistingFinalPlan || !refinedIdea.trim()}
                            className="btn-modern-primary !h-10 !px-8 text-xs !bg-white/10 !text-white hover:!bg-white/20 !border-white/20 disabled:opacity-50"
                        >
                            {isPersistingFinalPlan ? 'Saving Plan...' : 'Generate Structured Plan'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
