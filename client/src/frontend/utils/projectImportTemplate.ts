const PROJECT_TEMPLATE_VERSION = "akasha.project-template.v1";

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
            template_version: PROJECT_TEMPLATE_VERSION,
            notes: "Edit this JSON, then import it from the New Project dialog.",
            name: resolvedName,
            description: "A starter project imported from a JSON template.",
            settings: {
                theme: {
                    primary_color: "#0ea5e9",
                },
            },
            pages: [
                {
                    name: "Home",
                    path: "/",
                    meta: {
                        title: `${resolvedName} Home`,
                        description: "Landing page for the project",
                    },
                    blocks: [
                        {
                            type: "section",
                            name: "Hero Section",
                            styles: {
                                padding: "48px",
                            },
                            children: [
                                {
                                    type: "heading",
                                    name: "Hero Title",
                                    properties: {
                                        text: `Welcome to ${resolvedName}`,
                                        level: 1,
                                    },
                                },
                                {
                                    type: "paragraph",
                                    name: "Hero Copy",
                                    properties: {
                                        text: "Replace this text with your product value proposition.",
                                    },
                                },
                                {
                                    type: "button",
                                    name: "Primary CTA",
                                    properties: {
                                        text: "Get Started",
                                    },
                                },
                            ],
                        },
                    ],
                },
                {
                    name: "About",
                    path: "/about",
                    meta: {
                        title: `About ${resolvedName}`,
                    },
                    blocks: [
                        {
                            type: "section",
                            name: "About Section",
                            children: [
                                {
                                    type: "heading",
                                    name: "About Heading",
                                    properties: {
                                        text: `About ${resolvedName}`,
                                        level: 2,
                                    },
                                },
                                {
                                    type: "paragraph",
                                    name: "About Copy",
                                    properties: {
                                        text: "Describe the product, company, or workflow here.",
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        null,
        2,
    );
}

export function downloadSampleProjectTemplate(projectName?: string): string {
    const json = getSampleProjectTemplateJson(projectName);
    const resolvedName = projectName?.trim() || "sample-project";
    const fileName = `${slugifyFileName(resolvedName)}.project-template.json`;
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);

    return fileName;
}
