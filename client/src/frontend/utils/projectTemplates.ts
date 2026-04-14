export function getSampleProjectIdeaJson(projectName = "New Project"): string {
    const sampleBrief = {
        meta: {
            template: "new-project-brief",
            note: "Sample JSON. Edit these values before running analysis.",
            project_name: projectName,
        },
        problem: {
            statement: "Freelancers lose time switching between client messages, task tracking, invoices, and status updates.",
            target_users: ["Freelancers", "Small agencies"],
            pain_points: [
                "Project information is scattered across tools",
                "Clients ask for status updates manually",
                "Invoices and approvals are easy to miss",
            ],
        },
        solution: {
            product_summary: "A web app that centralizes project tracking, client collaboration, invoicing, and weekly summaries.",
            core_value: "Help small delivery teams run client work from one workspace.",
            must_have_features: [
                "Project dashboard with milestones and tasks",
                "Client portal for comments and approvals",
                "Invoice and payment status tracking",
                "Weekly AI-generated project summary",
            ],
            nice_to_have_features: [
                "Slack notifications",
                "Time tracking",
                "Proposal templates",
            ],
        },
        scope: {
            platforms: ["Web"],
            integrations: ["Email", "Stripe", "Google Calendar"],
            timeline: "6 to 8 weeks for MVP",
            team: ["2 full-stack engineers", "1 product designer"],
        },
        technical_requirements: {
            frontend: ["Responsive dashboard", "Role-based views"],
            backend: ["REST API", "Authentication", "Background jobs"],
            data_entities: ["Users", "Projects", "Tasks", "Invoices", "Comments"],
            non_functional: ["Audit trail", "Basic analytics", "Secure file access"],
        },
        success_metrics: [
            "Reduce status-update time by 50 percent",
            "Increase on-time invoice collection",
            "Improve weekly active usage per client project",
        ],
    };

    return JSON.stringify(sampleBrief, null, 2);
}
