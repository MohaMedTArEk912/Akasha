/**
 * generateCode.ts
 *
 * Utility to convert Craft.js serialized nodes into clean React/Tailwind JSX.
 */

import { SerializedNodes } from "@craftjs/core";
import { BLOCK_REGISTRY } from "./blockRegistry";

export function generateReactCode(nodes: SerializedNodes, rootNodeId: string = "ROOT"): string {
    if (!nodes || Object.keys(nodes).length === 0) return "";

    const generateStyles = (styles: Record<string, string | number>): string => {
        if (!styles || Object.keys(styles).length === 0) return "";
        const styleEntries = Object.entries(styles)
            .filter(([_, v]) => v !== undefined && v !== "")
            .map(([k, v]) => `${k}: "${v}"`);
        if (styleEntries.length === 0) return "";
        return ` style={{ ${styleEntries.join(", ")} }}`;
    };

    const processNode = (nodeId: string, indent: number = 4): string => {
        const node = nodes[nodeId];
        if (!node) return "";

        const { type: componentType, props } = node;
        const resolvedType = typeof componentType === "string" ? componentType : componentType.resolvedName || "div";

        let blockType = resolvedType;
        if (resolvedType === "CraftBlock" && props.blockType) {
            blockType = props.blockType;
        }

        const meta = BLOCK_REGISTRY[blockType];

        // Base classes from registry
        const registryClasses = meta?.appearance ?? "p-3 bg-white rounded-lg border border-slate-200 min-h-[36px]";
        const userClasses = props.classes ? (props.classes as string[]).join(" ") : "";
        const finalClasses = userClasses || registryClasses;
        const classNameAttr = finalClasses ? ` className="${finalClasses}"` : "";

        const styleAttr = generateStyles(props.styles || {});

        const indentStr = " ".repeat(indent);
        const childIndentStr = " ".repeat(indent + 4);

        // Render based on blockType
        const textContent = props.text as string || "";

        switch (blockType) {
            case "heading":
                const level = props.properties?.level || 2;
                return `${indentStr}<h${level}${classNameAttr}${styleAttr}>${textContent}</h${level}>`;
            case "paragraph":
            case "text":
                return `${indentStr}<p${classNameAttr}${styleAttr}>${textContent}</p>`;
            case "button":
                return `${indentStr}<button${classNameAttr}${styleAttr}>${textContent}</button>`;
            case "link":
                const href = props.properties?.href || "#";
                return `${indentStr}<a href="${href}"${classNameAttr}${styleAttr}>${textContent}</a>`;
            case "image":
                const src = props.properties?.src || "";
                return `${indentStr}<img src="${src}" alt="Image"${classNameAttr}${styleAttr} />`;
            case "video":
                return `${indentStr}<video${classNameAttr}${styleAttr} controls />`;
            case "input":
                const inputType = props.properties?.inputType || "text";
                return `${indentStr}<input type="${inputType}" placeholder="${textContent}"${classNameAttr}${styleAttr} />`;
            case "textarea":
                return `${indentStr}<textarea placeholder="${textContent}"${classNameAttr}${styleAttr}></textarea>`;
            case "select":
                return `${indentStr}<select${classNameAttr}${styleAttr}>\n${childIndentStr}<option value="">${textContent}</option>\n${indentStr}</select>`;
            case "checkbox":
                return `${indentStr}<div${classNameAttr}${styleAttr}>\n${childIndentStr}<input type="checkbox" />\n${childIndentStr}<span>${textContent}</span>\n${indentStr}</div>`;
            case "icon":
                return `${indentStr}<svg${classNameAttr}${styleAttr} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`;
            case "instance":
                return `${indentStr}<!-- Component Instance -->\n${indentStr}<ComponentInstance${classNameAttr}${styleAttr} />`;
            case "table":
                return `${indentStr}<table${classNameAttr}${styleAttr}>\n${childIndentStr}<tbody>\n${childIndentStr}    <tr><td>Table Data</td></tr>\n${childIndentStr}</tbody>\n${indentStr}</table>`;
        }

        // Generic Container types (container, section, flex, grid, etc.)
        let tag = "div";
        if (blockType === "section") tag = "section";
        if (blockType === "form") tag = "form";

        const childNodeIds = node.nodes || [];
        if (childNodeIds.length === 0) {
            return `${indentStr}<${tag}${classNameAttr}${styleAttr} />`;
        }

        const childNodesHtml = childNodeIds
            .map((id) => processNode(id, indent + 4))
            .join("\n");

        return `${indentStr}<${tag}${classNameAttr}${styleAttr}>\n${childNodesHtml}\n${indentStr}</${tag}>`;
    };

    const componentBody = processNode(rootNodeId, 8);

    return `import React from "react";

export default function ExportedComponent() {
    return (
${componentBody}
    );
}
`;
}
