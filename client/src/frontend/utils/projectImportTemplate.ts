function slugifyFileName(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "sample-project";
}

export function getSampleProjectTemplateJson(projectName?: string): string {
    const resolvedName = projectName?.trim() || "Sample Project";

    return JSON.stringify(
        {
            title: resolvedName,
            summary:
                "Describe the product vision in plain language. Include what the system does, who it serves, and why it matters.",
            target_audience: [
                "Primary users (e.g. patients, doctors, nurses)",
                "Secondary users (e.g. admins, finance, support)",
            ],
            core_value_proposition: [
                "What key value this product delivers",
                "How it improves current workflows",
            ],
            problem_statement: [
                "What is broken today",
                "What pain points must be solved first",
            ],
            decision_summary: [],
            key_features: [
                "Feature 1",
                "Feature 2",
                "Feature 3",
            ],
            user_flows: [
                "User flow 1",
                "User flow 2",
            ],
            technical_architecture: [
                "Frontend",
                "Backend",
                "Database",
                "Integrations",
            ],
            data_api_requirements: [
                "Entities and data model notes",
                "API endpoint requirements",
            ],
            milestones: [
                "Milestone 1",
                "Milestone 2",
            ],
            success_metrics: [
                "KPI 1",
                "KPI 2",
            ],
            risks: [
                "Risk 1",
                "Risk 2",
            ],
            implementation_checklist: [
                "Task 1",
                "Task 2",
            ],
            open_questions: [
                "Question 1",
            ],
        },
        null,
        2,
    );
}

export function downloadSampleProjectTemplate(projectName?: string): string {
    const json = getSampleProjectTemplateJson(projectName);
    const resolvedName = projectName?.trim() || "sample-project";
    const fileName = `${slugifyFileName(resolvedName)}.product-vision.json`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);

    return fileName;
}
