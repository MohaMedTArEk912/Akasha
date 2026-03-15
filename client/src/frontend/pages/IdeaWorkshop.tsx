import React, { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { useToast } from '../context/ToastContext';
import { httpApi } from '../hooks/useHttpApi';
import StructuredAiResponseCard from '../components/ui/StructuredAiResponse';
import { normalizeAiResponse, type StructuredAiResponse } from '../utils/aiResponse';

interface IdeaWorkshopProps {
    projectName: string;
    projectId?: string;
    initialIdea?: string;
    fullScreen?: boolean;
    onRefined: (refinedIdea: string) => void;
    onCancel: () => void;
}

type Phase = 'input' | 'analyzing' | 'discussion' | 'refining' | 'complete';
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
                };
            })
            .filter((item): item is FeatureDecision => !!item)
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
    if (value >= 4) return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
    if (value >= 3) return 'bg-amber-500/20 border-amber-500/40 text-amber-300';
    return 'bg-rose-500/20 border-rose-500/40 text-rose-300';
}

function getPriorityStyle(priority: FeaturePriority) {
    if (priority === 'critical') return 'bg-rose-500/20 border-rose-500/40 text-rose-200';
    if (priority === 'high') return 'bg-amber-500/20 border-amber-500/40 text-amber-200';
    if (priority === 'medium') return 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200';
    return 'bg-white/10 border-white/15 text-white/60';
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

function buildPreviewSections(doc: RefinedIdeaDoc | null, understanding: IdeaUnderstanding | null) {
    return [
        {
            id: 'understanding',
            title: 'Understanding',
            items: [
                understanding?.core_problem || '',
                understanding?.intended_solution || '',
                ...(understanding?.target_users || []).slice(0, 2).map((item) => `User: ${item}`),
            ].filter(Boolean),
        },
        {
            id: 'problem',
            title: 'Problem',
            items: doc?.problem_statement || [],
        },
        {
            id: 'value',
            title: 'Value',
            items: doc?.core_value_proposition || [],
        },
        {
            id: 'features',
            title: 'Features',
            items: (doc?.key_features || []).map((feature) => `${feature.feature} (${feature.rating}/5)`),
        },
        {
            id: 'flows',
            title: 'Flows',
            items: doc?.user_flows || [],
        },
        {
            id: 'architecture',
            title: 'Architecture',
            items: doc?.technical_architecture || [],
        },
        {
            id: 'apis',
            title: 'Data & APIs',
            items: doc?.data_api_requirements || [],
        },
        {
            id: 'milestones',
            title: 'Milestones',
            items: (doc?.milestones || []).map((item) => `${item.milestone}: ${item.scope || item.eta || 'Planned'}`),
        },
        {
            id: 'metrics',
            title: 'Success Metrics',
            items: doc?.success_metrics || [],
        },
        {
            id: 'risks',
            title: 'Risks',
            items: (doc?.risks || []).map((item) => `${item.risk} -> ${item.mitigation || item.impact || 'Mitigate'}`),
        },
        {
            id: 'checklist',
            title: 'Checklist',
            items: doc?.implementation_checklist || [],
        },
        {
            id: 'questions',
            title: 'Open Questions',
            items: doc?.open_questions || understanding?.assumptions || [],
        },
    ];
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
    const [idea, setIdea] = useState(initialIdea);
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
    const [newFeature, setNewFeature] = useState('');
    const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
    const [previewRevealCount, setPreviewRevealCount] = useState(0);

    const draftStorageKey = useMemo(
        () => `akasha:idea-workshop:draft:${projectId || projectName}`,
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
    const previewSections = useMemo(
        () => buildPreviewSections(workingDoc, analysis?.understanding || null),
        [analysis?.understanding, workingDoc]
    );

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
        if (initialIdea.trim()) return;
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

    useEffect(() => {
        if (phase !== 'discussion' || previewSections.length === 0) return;
        setPreviewRevealCount(0);
        const timers = previewSections.map((_, index) =>
            window.setTimeout(() => {
                setPreviewRevealCount((current) => Math.max(current, index + 1));
            }, 140 + index * 120)
        );

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [phase, analysis?.summary]);

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]';
        if (score >= 60) return 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]';
        return 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]';
    };

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

    const runAnalyze = async () => {
        if (!idea.trim()) {
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
            const result = normalizeAnalysisResult(await httpApi.analyzeIdea(idea));
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
            toast.showToast('Failed to analyze idea', 'error');
            setPhase('input');
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
                        feature: feature.title,
                        include: feature.include,
                        rating: feature.rating,
                        comment: feature.comment,
                    })),
                    null,
                    2
                ) +
                '\n\nUser request:\n' +
                userMsg;

            const res = await fetch('http://localhost:3001/api/ai/simple-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: contextMsg }),
            });

            const data = await res.json();
            if (res.ok) {
                const structured = normalizeAiResponse(data);
                setHistory((prev) => [...prev, { role: 'assistant', content: structured.answer_markdown, structured }]);
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

    const reviewCurrentFeature = async (action: 'revise' | 'approve' | 'reject') => {
        if (!currentFeature || isChatting) return;
        if (action === 'revise' && !currentFeature.comment.trim()) {
            toast.showToast('Add feedback before asking the AI to rewrite the feature.', 'warning');
            return;
        }

        setDetailsLoadingId(currentFeature.id);
        setIsChatting(true);
        try {
            const response = await httpApi.reviewIdeaFeature({
                idea,
                action,
                feature: {
                    ...currentFeature,
                    user_comment: currentFeature.comment,
                    integrated_summary: currentFeature.integratedSummary,
                },
                structuredConcept: workingDoc,
                feedback: currentFeature.comment,
                approvedFeatures: featureDecisions
                    .filter((feature) => feature.status === 'approved')
                    .map((feature) => ({
                        ...feature,
                        user_comment: feature.comment,
                        integrated_summary: feature.integratedSummary,
                    })),
                rejectedFeatures: featureDecisions
                    .filter((feature) => feature.status === 'rejected')
                    .map((feature) => ({
                        ...feature,
                        user_comment: feature.comment,
                        integrated_summary: feature.integratedSummary,
                    })),
            });

            const reviewedFeature = buildFeatureDecisions({
                feature_queue: [response?.feature],
            })[0];
            const nextDoc = normalizeRefinedDoc(response?.structured_concept);

            if (reviewedFeature) {
                setFeatureDecisions((prev) =>
                    prev.map((feature) =>
                        feature.id === currentFeature.id
                            ? {
                                ...feature,
                                ...reviewedFeature,
                                include: reviewedFeature.status !== 'rejected',
                                comment: reviewedFeature.comment || feature.comment,
                                integratedSummary: reviewedFeature.integratedSummary,
                            }
                            : feature
                    )
                );
            }

            if (nextDoc) {
                setWorkingDoc(nextDoc);
            }

            if (typeof response?.integration_note === 'string' && response.integration_note.trim()) {
                setHistory((prev) => [...prev, { role: 'assistant', content: response.integration_note.trim() }]);
            }
        } catch (err: any) {
            toast.showToast(err?.message || 'Failed to review feature', 'error');
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

            if (normalizedDoc) {
                setRefinedDoc(normalizedDoc);
                setRefinedIdea(fallbackMarkdown || docToMarkdown(normalizedDoc));
            } else {
                setRefinedDoc(null);
                setRefinedIdea(fallbackMarkdown);
            }
            setPhase('complete');
        } catch (err: any) {
            toast.showToast('Failed to refine idea', 'error');
            setPhase('discussion');
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
                                    ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20 rounded-tr-sm'
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
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
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
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all"
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
                    className={`bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-400 disabled:opacity-50 transition-all ${
                        fullScreen ? 'h-10 px-5 text-sm' : 'h-8 px-4 text-xs'
                    }`}
                >
                    Send
                </button>
            </form>
        </div>
    );

    const renderProgressiveConceptPreview = () => (
        <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs font-black text-cyan-300 uppercase tracking-widest">Live Project Concept</div>
                    <p className="text-[11px] text-white/45 mt-1">
                        The AI creates the structure first, then fills each section progressively.
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] uppercase tracking-widest text-white/40">Sections</div>
                    <div className="text-sm font-black text-white">{Math.min(previewRevealCount, previewSections.length)}/{previewSections.length}</div>
                </div>
            </div>

            {workingDoc?.summary && (
                <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Structured Summary</div>
                    <p className="mt-2 text-sm text-white/80 leading-relaxed">{workingDoc.summary}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {previewSections.map((section, index) => {
                    const isReady = index < previewRevealCount;
                    const hasItems = section.items.length > 0;

                    return (
                        <div key={section.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 min-h-[148px]">
                            <div className="flex items-center justify-between gap-2">
                                <div className="text-[11px] font-black uppercase tracking-widest text-white/60">{section.title}</div>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border ${
                                    isReady
                                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                                        : 'bg-white/10 border-white/15 text-white/45'
                                }`}>
                                    {isReady ? 'Ready' : 'Loading'}
                                </span>
                            </div>

                            {isReady ? (
                                <ul className="mt-3 space-y-1.5 text-xs text-white/80">
                                    {hasItems ? section.items.slice(0, 5).map((item, itemIndex) => (
                                        <li key={`${section.id}-${itemIndex}`} className="flex items-start gap-2">
                                            <span className="mt-0.5 text-cyan-400/70">•</span>
                                            <span>{item}</span>
                                        </li>
                                    )) : (
                                        <li className="text-white/35">No content generated for this section yet.</li>
                                    )}
                                </ul>
                            ) : (
                                <div className="mt-4 space-y-2">
                                    <div className="h-3 rounded-full bg-white/8 animate-pulse" />
                                    <div className="h-3 w-5/6 rounded-full bg-white/8 animate-pulse" />
                                    <div className="h-3 w-2/3 rounded-full bg-white/8 animate-pulse" />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderFeatureDecisionBoard = () => (
        <div className="bg-violet-500/5 border border-violet-500/15 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-xs font-black text-violet-300 uppercase tracking-widest">Sequential Feature Queue</div>
                    <p className="text-[11px] text-white/50 mt-1">Review one AI-suggested feature at a time. Rewrite it with feedback, then approve or reject it.</p>
                </div>
                <div className="text-right">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider">Reviewed</div>
                    <div className="text-sm font-black text-violet-300">
                        {featureDecisions.filter((feature) => feature.status !== 'pending').length}/{featureDecisions.length}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                    <div className="text-white/45">Approved</div>
                    <div className="mt-1 text-lg font-black text-white">{selectedFeatures.length}</div>
                </div>
                <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                    <div className="text-white/45">Pending</div>
                    <div className="mt-1 text-lg font-black text-white">{featureDecisions.filter((feature) => feature.status === 'pending').length}</div>
                </div>
                <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                    <div className="text-white/45">Queue Ready</div>
                    <div className="mt-1 text-lg font-black text-white">{queueComplete ? 'Yes' : 'No'}</div>
                </div>
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add a custom feature into the queue..."
                    className="flex-1 h-10 rounded-xl bg-black/20 border border-white/10 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-violet-400/40"
                />
                <button
                    onClick={handleAddFeature}
                    type="button"
                    className="h-10 px-4 rounded-xl text-xs font-bold bg-violet-500/20 border border-violet-500/40 text-violet-200 hover:bg-violet-500/30 transition-all"
                >
                    Add Feature
                </button>
            </div>

            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                {featureDecisions.map((feature, index) => (
                    <div
                        key={feature.id}
                        className={`rounded-xl border p-3 transition-all ${
                            currentFeature?.id === feature.id
                                ? 'border-violet-400/40 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]'
                                : 'border-white/10 bg-black/20'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/35">#{index + 1}</span>
                                    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${getPriorityStyle(feature.priority)}`}>
                                        {feature.priority}
                                    </span>
                                    <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wide ${
                                        feature.status === 'approved'
                                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
                                            : feature.status === 'rejected'
                                                ? 'bg-white/10 border-white/15 text-white/45'
                                                : 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                                    }`}>
                                        {feature.status}
                                    </span>
                                </div>
                                <div className="mt-2 text-sm font-semibold text-white">{feature.title}</div>
                                <div className="mt-1 text-xs text-white/55 leading-relaxed">
                                    {feature.integratedSummary || feature.description || feature.rationale || 'Waiting for review.'}
                                </div>
                            </div>
                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${getRatingStyle(feature.rating)}`}>
                                {feature.rating}/5
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/45">Current Suggestion</div>
                        {currentFeature ? (
                            <>
                                <h4 className="mt-2 text-lg font-black text-white">{currentFeature.title}</h4>
                                <p className="mt-2 text-sm text-white/70 leading-relaxed">
                                    {currentFeature.description || currentFeature.rationale || 'The AI will refine this feature when you add feedback.'}
                                </p>
                            </>
                        ) : (
                            <p className="mt-2 text-sm text-emerald-200">All queued features were reviewed. You can finalize the concept now.</p>
                        )}
                    </div>
                    {currentFeature && (
                        <span className={`inline-flex px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wide ${getPriorityStyle(currentFeature.priority)}`}>
                            {currentFeature.priority}
                        </span>
                    )}
                </div>

                {currentFeature && (
                    <>
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-white/45 mb-2">Priority Rating</div>
                            <div className="flex flex-wrap items-center gap-2">
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <button
                                        key={`${currentFeature.id}-rating-${level}`}
                                        type="button"
                                        onClick={() => setFeatureDecision(currentFeature.id, (feature) => ({ ...feature, rating: level as 1 | 2 | 3 | 4 | 5 }))}
                                        className={`h-8 w-8 rounded-lg border text-[11px] font-black transition-all ${
                                            currentFeature.rating === level
                                                ? getRatingStyle(level)
                                                : 'border-white/15 bg-white/5 text-white/50 hover:text-white'
                                        }`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <textarea
                            value={currentFeature.comment}
                            onChange={(e) => setFeatureDecision(currentFeature.id, (feature) => ({ ...feature, comment: e.target.value }))}
                            placeholder="Add feedback. The AI will rewrite this feature until you explicitly approve it."
                            rows={3}
                            className="w-full rounded-xl bg-black/25 border border-white/10 px-3 py-3 text-sm text-white/85 placeholder:text-white/35 focus:outline-none focus:border-violet-400/40 resize-none"
                        />

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => reviewCurrentFeature('revise')}
                                disabled={isChatting || detailsLoadingId === currentFeature.id}
                                className="h-10 px-4 rounded-xl text-xs font-bold bg-cyan-500/15 border border-cyan-500/30 text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-50 transition-all"
                            >
                                {detailsLoadingId === currentFeature.id ? 'Rewriting...' : 'Rewrite From Feedback'}
                            </button>
                            <button
                                type="button"
                                onClick={() => reviewCurrentFeature('approve')}
                                disabled={isChatting || detailsLoadingId === currentFeature.id}
                                className="h-10 px-4 rounded-xl text-xs font-bold bg-emerald-500/20 border border-emerald-500/35 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50 transition-all"
                            >
                                Approve & Integrate
                            </button>
                            <button
                                type="button"
                                onClick={() => reviewCurrentFeature('reject')}
                                disabled={isChatting || detailsLoadingId === currentFeature.id}
                                className="h-10 px-4 rounded-xl text-xs font-bold bg-white/8 border border-white/15 text-white/70 hover:bg-white/12 disabled:opacity-50 transition-all"
                            >
                                Reject
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div className="text-[11px] text-white/45">
                Final draft readiness: {selectedFeatures.length} approved feature(s), average rating {averageRating || 0}/5.
            </div>
        </div>
    );

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
                cyan: 'bg-cyan-500/8 border-cyan-500/20 text-cyan-100/80',
                emerald: 'bg-emerald-500/8 border-emerald-500/20 text-emerald-100/80',
                amber: 'bg-amber-500/8 border-amber-500/20 text-amber-100/80',
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
                <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">JSON PRD</div>
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
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4">
                    <div className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-2">Decision Snapshot</div>
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
                                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${feature.include ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-white/10 border-white/20 text-white/60'}`}>
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
                        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 p-3">
                            <div className="text-[11px] font-black text-emerald-300 uppercase tracking-wide">High (4-5)</div>
                            <ul className="mt-2 space-y-1 text-xs text-emerald-100/80">
                                {high.length > 0 ? high.map((item) => <li key={`high-${item.id}`}>• {item.title}</li>) : <li>• None</li>}
                            </ul>
                        </div>
                        <div className="rounded-xl bg-amber-500/8 border border-amber-500/20 p-3">
                            <div className="text-[11px] font-black text-amber-300 uppercase tracking-wide">Medium (3)</div>
                            <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                                {medium.length > 0 ? medium.map((item) => <li key={`medium-${item.id}`}>• {item.title}</li>) : <li>• None</li>}
                            </ul>
                        </div>
                        <div className="rounded-xl bg-rose-500/8 border border-rose-500/20 p-3">
                            <div className="text-[11px] font-black text-rose-300 uppercase tracking-wide">Low (1-2)</div>
                            <ul className="mt-2 space-y-1 text-xs text-rose-100/80">
                                {low.length > 0 ? low.map((item) => <li key={`low-${item.id}`}>• {item.title}</li>) : <li>• None</li>}
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-cyan-500/8 border border-cyan-500/20 p-4">
                        <div className="text-[11px] font-black text-cyan-300 uppercase tracking-widest mb-2">Open Questions</div>
                        <ul className="space-y-1 text-xs text-cyan-100/80">
                            {(analysis?.questions || []).length > 0
                                ? (analysis.questions as string[]).map((item: string, index: number) => (
                                    <li key={`question-${index}`}>• {item}</li>
                                ))
                                : <li>• No open questions captured.</li>}
                        </ul>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/8 border border-emerald-500/20 p-4">
                        <div className="text-[11px] font-black text-emerald-300 uppercase tracking-widest mb-2">Idea Improvement Focus</div>
                        <ul className="space-y-1 text-xs text-emerald-100/80">
                            {(analysis?.suggestions || []).length > 0
                                ? (analysis.suggestions as string[]).map((item: string, index: number) => (
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
            className={`w-full flex flex-col bg-[var(--ide-bg-panel)] overflow-hidden relative ${
                fullScreen
                    ? 'h-full rounded-none border-0 shadow-none'
                    : 'max-w-4xl mx-auto h-[80vh] rounded-3xl border border-[var(--ide-border-strong)] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] animate-slide-up'
            }`}
        >
            <div className="flex-shrink-0 border-b border-[var(--ide-border)] bg-gradient-to-b from-white/[0.03] to-transparent">
                <div className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg md:text-xl font-black text-[var(--ide-text)]">AI Idea Workshop</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-[var(--ide-text-secondary)] uppercase tracking-widest font-black">Project:</span>
                                <span className="text-xs text-indigo-400 font-bold">{projectName}</span>
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
                                            ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-200'
                                            : isDone
                                                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-200'
                                                : 'border-white/10 bg-white/[0.02] text-white/45'
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
                        <div className="space-y-4">
                            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/8 p-4">
                                <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Idea Readiness</div>
                                <div className="mt-2 flex items-end justify-between">
                                    <div className="text-3xl font-black text-white">{ideaReadinessScore}%</div>
                                    <div className="text-[11px] text-white/45">{ideaWordCount} words</div>
                                </div>
                                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 transition-all duration-300"
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
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                                        : 'bg-white/8 text-white/45 border border-white/15'
                                                }`}
                                            >
                                                {check.done ? '✓' : '•'}
                                            </span>
                                            <span className={check.done ? 'text-white/85' : 'text-white/45'}>{check.label}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/8 p-4 space-y-3">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-cyan-300">Templates</div>
                                    <p className="mt-1 text-[11px] text-cyan-100/70">Kickstart with guided sections.</p>
                                </div>
                                <button
                                    onClick={applyFullTemplate}
                                    type="button"
                                    className="w-full h-9 rounded-xl text-xs font-bold bg-cyan-500/20 border border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/30 transition-all"
                                >
                                    Insert Full Template
                                </button>
                            </div>
                        </div>

                        <div className="min-h-0 flex flex-col gap-4">
                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex items-start gap-4">
                                <div className="text-xl">💡</div>
                                <div className="text-sm text-indigo-200">
                                    <strong className="block text-indigo-400 mb-1">Write with structure, then let AI sharpen it.</strong>
                                    Include problem, user, value, MVP scope, and constraints. Better input gives stronger analysis and better final docs.
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
                                    className="block w-full h-full min-h-[280px] box-border bg-transparent rounded-xl p-3 md:p-4 text-[var(--ide-text)] text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[var(--ide-text-muted)] font-medium px-1">
                                <span>{ideaWordCount} words</span>
                                <span>{idea.trim().length} characters</span>
                            </div>
                        </div>
                    </div>
                )}

                {(phase === 'analyzing' || phase === 'refining') && (
                    <div className="h-full min-h-0 animate-fade-in grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-4">
                        <div className="bg-[var(--ide-bg-elevated)] border border-[var(--ide-border)] rounded-2xl p-4 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <div className="w-14 h-14 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center text-xl">🤖</div>
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-white">
                                        {phase === 'analyzing' ? 'Building the project concept...' : 'Polishing the final PRD...'}
                                    </h3>
                                    <p className="text-sm text-[var(--ide-text-secondary)]">
                                        {phase === 'analyzing'
                                            ? 'Understanding the idea first, then filling the concept sections progressively.'
                                            : 'Converting the approved concept into the final structured output.'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {Array.from({ length: 8 }).map((_, index) => (
                                    <div key={`preview-skeleton-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 min-h-[148px]">
                                        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
                                        <div className="mt-4 space-y-2">
                                            <div className="h-3 rounded-full bg-white/8 animate-pulse" />
                                            <div className="h-3 w-5/6 rounded-full bg-white/8 animate-pulse" />
                                            <div className="h-3 w-2/3 rounded-full bg-white/8 animate-pulse" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-2xl p-4 space-y-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-violet-300">Feature Queue Skeleton</div>
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                    <div key={`queue-skeleton-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-4">
                                        <div className="h-3 w-20 rounded-full bg-white/10 animate-pulse" />
                                        <div className="mt-3 h-4 w-3/4 rounded-full bg-white/8 animate-pulse" />
                                        <div className="mt-2 h-3 w-full rounded-full bg-white/8 animate-pulse" />
                                        <div className="mt-2 h-3 w-2/3 rounded-full bg-white/8 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {phase === 'discussion' && analysis && (
                    <div
                        className={`h-full min-h-0 animate-fade-in ${
                            fullScreen ? 'grid grid-cols-1 xl:grid-cols-[1.1fr,0.9fr] gap-4' : 'flex flex-col space-y-6'
                        }`}
                    >
                        <div
                            className={`space-y-4 ${
                                fullScreen ? 'min-h-0 overflow-y-auto custom-scrollbar pr-1' : 'shrink-0'
                            }`}
                        >
                            <div className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/5 rounded-2xl p-5 relative overflow-hidden">
                                <div className="absolute -inset-4 bg-indigo-500/5 blur-xl" />
                                <div className="relative z-10">
                                    <div className="text-xs font-black text-[var(--ide-text-secondary)] uppercase tracking-widest mb-2">
                                        Viability Score
                                    </div>
                                    <div className={`text-5xl font-black ${getScoreColor(Number(analysis.score || 0))}`}>
                                        {analysis.score ?? 0}
                                    </div>
                                    <p className="text-xs text-[var(--ide-text-muted)] mt-3 italic">
                                        "{analysis.summary || 'No summary provided.'}"
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4">
                                    <div className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">Strengths</div>
                                    <ul className="space-y-1.5">
                                        {(analysis.strengths || []).map((s: string, i: number) => (
                                            <li key={i} className="text-xs text-[var(--ide-text-secondary)] flex items-start gap-2">
                                                <span className="text-emerald-500/50 mt-0.5">•</span>
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-4">
                                    <div className="text-xs font-black text-rose-400 uppercase tracking-widest mb-2">Risks</div>
                                    <ul className="space-y-1.5">
                                        {(analysis.weaknesses || []).map((w: string, i: number) => (
                                            <li key={i} className="text-xs text-[var(--ide-text-secondary)] flex items-start gap-2">
                                                <span className="text-rose-500/50 mt-0.5">•</span>
                                                {w}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-2xl p-4">
                                <div className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-2">Questions</div>
                                <div className="flex flex-wrap gap-2">
                                    {(analysis.questions || []).map((q: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => handleQuickPrompt(q)}
                                            className="px-2.5 py-1 bg-cyan-500/10 text-cyan-200 text-[11px] rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition-all"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {renderProgressiveConceptPreview()}
                        </div>

                        <div className="min-h-0 flex flex-col gap-4">
                            {renderFeatureDecisionBoard()}
                            {renderChatPanel()}
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
                            onClick={runAnalyze}
                            className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all text-xs font-bold"
                        >
                            Re-analyze
                        </button>
                    )}

                    {phase === 'complete' && (
                        <>
                            <button
                                onClick={handleCopyJson}
                                className="h-10 px-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/20 transition-all text-xs font-bold"
                            >
                                {jsonCopied ? 'JSON Copied' : 'Copy JSON'}
                            </button>
                            <button
                                onClick={handleDownloadJson}
                                className="h-10 px-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:text-cyan-100 hover:bg-cyan-500/20 transition-all text-xs font-bold"
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
                            onClick={runAnalyze}
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
                            className="btn-modern-primary !h-10 !px-8 text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500 hover:!from-emerald-400 hover:!to-teal-400 !shadow-emerald-500/20 disabled:opacity-50"
                            title={!canDraftFinalDoc ? 'Finish reviewing the queued features before finalizing the document.' : ''}
                        >
                            Confirm & Draft Final Document
                        </button>
                    )}

                    {phase === 'complete' && (
                        <button
                            onClick={() => onRefined(refinedIdea)}
                            className="btn-modern-primary !h-10 !px-8 text-xs !bg-gradient-to-r !from-emerald-500 !to-teal-500 hover:!from-emerald-400 hover:!to-teal-400 !shadow-emerald-500/20"
                        >
                            Generate Structured Plan
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
