function slugifyFileName(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "project-spec";
}

/**
 * Returns a clean, unpopulated project specification JSON schema.
 * Strictly zero canned mock strings or fake domain data.
 */
export function getCleanProjectSpecificationJson(projectName?: string): string {
    const resolvedName = projectName?.trim() || "";

    return JSON.stringify(
        {
            title: resolvedName,
            summary: "",
            target_audience: [],
            core_value_proposition: [],
            problem_statement: [],
            key_features: [],
            user_flows: [],
            technical_architecture: [],
            data_api_requirements: [],
            milestones: [],
            success_metrics: [],
        },
        null,
        2,
    );
}

export function downloadProjectSpecificationSchema(projectName?: string): string {
    const json = getCleanProjectSpecificationJson(projectName);
    const resolvedName = projectName?.trim() || "project-spec";
    const fileName = `${slugifyFileName(resolvedName)}.specification.json`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);

    return fileName;
}
