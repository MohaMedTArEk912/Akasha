import { randomUUID } from 'node:crypto';
import type { UiBuilderLayoutPlan, UiBuilderLayoutSection } from './uiBuilderSchema.js';

export interface BuilderBlock {
    id: string;
    block_type: string;
    name: string;
    parent_id?: string;
    page_id?: string;
    slot?: string;
    order: number;
    properties: Record<string, unknown>;
    styles: Record<string, string | number | boolean>;
    responsive_styles: Record<string, Record<string, string | number | boolean>>;
    bindings: Record<string, { type: string; value: unknown }>;
    event_handlers: Array<{ event: string; logic_flow_id: string }>;
    archived: boolean;
    component_id?: string;
    children?: string[];
    classes?: string[];
}

interface BuildContext {
    pageId: string;
    rootBlockId: string;
}

const SURFACE_STYLE = {
    backgroundColor: '#ffffff',
    borderRadius: '24px',
    border: '1px solid rgba(15, 23, 42, 0.08)',
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.06)',
};

class BuilderTreeWriter {
    private blocks: BuilderBlock[] = [];

    addBlock(input: Omit<BuilderBlock, 'order'>): BuilderBlock {
        const block: BuilderBlock = {
            ...input,
            order: this.blocks.length,
        };

        this.blocks.push(block);
        return block;
    }

    updateChildren(blockId: string, childIds: string[]) {
        const idx = this.blocks.findIndex((block) => block.id === blockId);
        if (idx === -1) return;
        const existing = this.blocks[idx];
        if (!existing) return;
        this.blocks[idx] = {
            ...existing,
            children: childIds,
        };
    }

    getBlocks(): BuilderBlock[] {
        return this.blocks;
    }
}

function createBlockId(existingId?: string): string {
    return existingId || randomUUID();
}

function createBaseBlock(
    writer: BuilderTreeWriter,
    type: string,
    name: string,
    parentId: string | undefined,
    pageId: string | undefined,
    properties: Record<string, unknown>,
    styles: Record<string, string | number | boolean>,
    classes: string[] = []
): BuilderBlock {
    return writer.addBlock({
        id: createBlockId(type === 'canvas' ? undefined : undefined),
        block_type: type,
        name,
        parent_id: parentId,
        page_id: pageId,
        properties,
        styles,
        responsive_styles: {},
        bindings: {},
        event_handlers: [],
        archived: false,
        children: [],
        classes,
    });
}

function createTextBlock(
    writer: BuilderTreeWriter,
    type: 'heading' | 'paragraph' | 'button',
    text: string,
    parentId: string,
    extraProps: Record<string, unknown> = {},
    extraStyles: Record<string, string | number | boolean> = {},
): BuilderBlock {
    const styles = type === 'heading'
        ? {
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: '1.05',
            ...extraStyles,
        }
        : type === 'paragraph'
            ? {
                fontSize: '15px',
                lineHeight: '1.7',
                color: '#475569',
                ...extraStyles,
            }
            : {
                backgroundColor: '#06b6d4',
                color: '#06243a',
                fontWeight: 700,
                padding: '14px 18px',
                borderRadius: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...extraStyles,
            };

    return createBaseBlock(
        writer,
        type,
        text.slice(0, 60) || type,
        parentId,
        undefined,
        { text, ...extraProps },
        styles,
    );
}

function createCardBlock(writer: BuilderTreeWriter, title: string, body: string, parentId: string): BuilderBlock {
    const card = createBaseBlock(
        writer,
        'card',
        title || 'Card',
        parentId,
        undefined,
        {},
        {
            ...SURFACE_STYLE,
            padding: '20px',
            minHeight: '160px',
        },
    );

    const heading = createTextBlock(writer, 'heading', title || 'Card title', card.id, { level: 3 }, {
        fontSize: '20px',
        marginBottom: '10px',
    });
    const paragraph = createTextBlock(writer, 'paragraph', body || 'Add supporting details here.', card.id, {}, {
        fontSize: '14px',
    });
    writer.updateChildren(card.id, [heading.id, paragraph.id]);
    return card;
}

function createSectionShell(writer: BuilderTreeWriter, section: UiBuilderLayoutSection, parentId: string): BuilderBlock {
    const paddingByEmphasis = section.emphasis === 'compact' ? '28px' : section.emphasis === 'primary' ? '42px' : '34px';
    return createBaseBlock(
        writer,
        'section',
        section.title || 'Section',
        parentId,
        undefined,
        {},
        {
            padding: paddingByEmphasis,
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            minHeight: '60px',
            backgroundColor: section.type === 'hero' ? '#f8fafc' : '#ffffff',
            borderRadius: '28px',
            border: '1px solid rgba(148, 163, 184, 0.14)',
        },
    );
}

function createColumns(writer: BuilderTreeWriter, parentId: string, columns: number): { wrapper: BuilderBlock; children: BuilderBlock[] } {
    const wrapper = createBaseBlock(
        writer,
        'columns',
        'Columns',
        parentId,
        undefined,
        {},
        {
            display: 'flex',
            gap: '16px',
            width: '100%',
        },
    );

    const children: BuilderBlock[] = [];
    const count = Math.max(1, columns);
    for (let index = 0; index < count; index += 1) {
        const column = createBaseBlock(
            writer,
            'column',
            `Column ${index + 1}`,
            wrapper.id,
            undefined,
            {},
            {
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
            },
        );
        children.push(column);
    }

    writer.updateChildren(wrapper.id, children.map((column) => column.id));
    return { wrapper, children };
}

function createFormSection(writer: BuilderTreeWriter, section: UiBuilderLayoutSection, sectionBlock: BuilderBlock): BuilderBlock {
    const form = createBaseBlock(
        writer,
        'form',
        `${section.title} Form`,
        sectionBlock.id,
        undefined,
        {},
        {
            ...SURFACE_STYLE,
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
        },
    );

    const fields = section.items.length > 0 ? section.items.slice(0, 4) : ['Name', 'Email', 'Message'];
    const childIds: string[] = [];
    fields.forEach((field, index) => {
        const type = index === fields.length - 1 && field.toLowerCase().includes('message') ? 'textarea' : 'input';
        const block = createBaseBlock(
            writer,
            type,
            field,
            form.id,
            undefined,
            { text: field, inputType: 'text', placeholder: field },
            {
                backgroundColor: '#ffffff',
                border: '1px solid rgba(148, 163, 184, 0.28)',
                borderRadius: '14px',
                padding: '14px 16px',
                minHeight: type === 'textarea' ? '120px' : '48px',
            },
        );
        childIds.push(block.id);
    });

    const submit = createTextBlock(writer, 'button', section.cta_label || 'Submit', form.id, {}, {
        marginTop: '10px',
        alignSelf: 'flex-start',
    });
    childIds.push(submit.id);
    writer.updateChildren(form.id, childIds);
    return form;
}

function createTableSection(writer: BuilderTreeWriter, section: UiBuilderLayoutSection, sectionBlock: BuilderBlock): BuilderBlock {
    const items = section.items.length > 0 ? section.items : ['Revenue', 'MRR', 'Conversion'];
    const table = createBaseBlock(
        writer,
        'table',
        section.title || 'Table',
        sectionBlock.id,
        undefined,
        {
            columns: ['Metric', 'Value', 'Status'],
            rows: items.map((item, index) => [item, `Metric ${index + 1}`, index % 2 === 0 ? 'Healthy' : 'Watch']),
        },
        {
            ...SURFACE_STYLE,
            padding: '18px',
            minHeight: '220px',
        },
    );
    writer.updateChildren(table.id, []);
    return table;
}

function createSectionContent(writer: BuilderTreeWriter, section: UiBuilderLayoutSection, sectionBlock: BuilderBlock) {
    const childIds: string[] = [];

    if (section.title) {
        const heading = createTextBlock(
            writer,
            'heading',
            section.title,
            sectionBlock.id,
            { level: section.type === 'hero' ? 1 : 2 },
            section.type === 'hero'
                ? { fontSize: 'clamp(36px, 5vw, 56px)', maxWidth: '12ch' }
                : { fontSize: '28px' },
        );
        childIds.push(heading.id);
    }

    if (section.description) {
        const paragraph = createTextBlock(writer, 'paragraph', section.description, sectionBlock.id, {}, {
            maxWidth: section.type === 'hero' ? '56ch' : '72ch',
        });
        childIds.push(paragraph.id);
    }

    switch (section.type) {
        case 'hero': {
            const columns = createColumns(writer, sectionBlock.id, 2);
            const [leftColumn, rightColumn] = columns.children;
            if (!leftColumn || !rightColumn) {
                childIds.push(columns.wrapper.id);
                break;
            }
            const leftIds: string[] = [];
            const rightIds: string[] = [];

            const badgeCard = createCardBlock(
                writer,
                section.items[0] || 'Guided workflow',
                section.items[1] || 'Expose the clearest value proposition and first action above the fold.',
                leftColumn.id,
            );
            leftIds.push(badgeCard.id);

            const primaryCta = createTextBlock(writer, 'button', section.cta_label || 'Get started', leftColumn.id, {}, {
                alignSelf: 'flex-start',
            });
            leftIds.push(primaryCta.id);

            const visual = createBaseBlock(
                writer,
                section.media === 'chart' ? 'table' : 'image',
                section.media === 'chart' ? 'Preview Chart' : 'Hero Image',
                rightColumn.id,
                undefined,
                section.media === 'chart'
                    ? {
                        columns: ['Signal', 'Value'],
                        rows: [['Activation', '78%'], ['Conversion', '+14%'], ['Retention', '91%']],
                    }
                    : {
                        src: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?auto=format&fit=crop&w=1200&q=80',
                        alt: section.title,
                    },
                {
                    minHeight: '280px',
                    borderRadius: '24px',
                    width: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#e2e8f0',
                },
            );
            rightIds.push(visual.id);

            writer.updateChildren(leftColumn.id, leftIds);
            writer.updateChildren(rightColumn.id, rightIds);
            childIds.push(columns.wrapper.id);
            break;
        }
        case 'stats':
        case 'features':
        case 'pricing':
        case 'testimonials':
        case 'activity':
        case 'dashboard':
        case 'content': {
            const columns = createColumns(writer, sectionBlock.id, section.columns || 3);
            const items = section.items.length > 0 ? section.items : ['Primary insight', 'Secondary insight', 'Execution detail'];
            const columnChildren = columns.children.map(() => [] as string[]);

            items.forEach((item, index) => {
                const targetColumn = columns.children[index % columns.children.length];
                if (!targetColumn) return;
                const card = createCardBlock(
                    writer,
                    item,
                    section.type === 'pricing'
                        ? 'Package the offer with scope, price signal, and a strong CTA.'
                        : section.type === 'testimonials'
                            ? 'Use concrete proof instead of generic praise.'
                            : 'Keep the content short, scannable, and outcome-oriented.',
                    targetColumn.id,
                );
                const bucket = columnChildren[index % columns.children.length];
                if (bucket) {
                    bucket.push(card.id);
                }
            });

            columns.children.forEach((column, index) => {
                writer.updateChildren(column.id, columnChildren[index] ?? []);
            });
            childIds.push(columns.wrapper.id);
            break;
        }
        case 'split': {
            const columns = createColumns(writer, sectionBlock.id, 2);
            const [leftColumn, rightColumn] = columns.children;
            if (!leftColumn || !rightColumn) {
                childIds.push(columns.wrapper.id);
                break;
            }
            const leftCard = createCardBlock(
                writer,
                section.items[0] || 'Primary narrative',
                'Keep the left side strategic and the right side concrete.',
                leftColumn.id,
            );
            const rightCard = createCardBlock(
                writer,
                section.items[1] || 'Supporting execution',
                'Use the second pane for details, evidence, or controls.',
                rightColumn.id,
            );
            writer.updateChildren(leftColumn.id, [leftCard.id]);
            writer.updateChildren(rightColumn.id, [rightCard.id]);
            childIds.push(columns.wrapper.id);
            break;
        }
        case 'form':
        case 'settings': {
            const form = createFormSection(writer, section, sectionBlock);
            childIds.push(form.id);
            break;
        }
        case 'faq': {
            const accordion = createBaseBlock(
                writer,
                'accordion',
                section.title || 'FAQ',
                sectionBlock.id,
                undefined,
                {},
                {
                    ...SURFACE_STYLE,
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                },
            );
            const faqIds = (section.items.length > 0 ? section.items : ['What is the core workflow?', 'How quickly do users reach value?', 'What happens after setup?'])
                .map((item) =>
                    createTextBlock(writer, 'paragraph', item, accordion.id, {}, { borderBottom: '1px solid rgba(148, 163, 184, 0.14)', paddingBottom: '10px' }).id
                );
            writer.updateChildren(accordion.id, faqIds);
            childIds.push(accordion.id);
            break;
        }
        case 'table':
            childIds.push(createTableSection(writer, section, sectionBlock).id);
            break;
        case 'cta': {
            const button = createTextBlock(writer, 'button', section.cta_label || section.items[0] || 'Continue', sectionBlock.id, {}, {
                alignSelf: 'flex-start',
            });
            childIds.push(button.id);
            break;
        }
        default:
            break;
    }

    writer.updateChildren(sectionBlock.id, childIds.filter(Boolean));
}

export function translateLayoutPlanToBlocks(
    layoutPlan: UiBuilderLayoutPlan,
    context: BuildContext,
): BuilderBlock[] {
    const writer = new BuilderTreeWriter();

    const root = writer.addBlock({
        id: context.rootBlockId,
        block_type: 'canvas',
        name: layoutPlan.page_name || 'Page Root',
        page_id: context.pageId,
        properties: {
            title: layoutPlan.page_name,
            purpose: layoutPlan.page_purpose,
        },
        styles: {
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '28px',
            minHeight: '100%',
            backgroundColor: '#f8fafc',
        },
        responsive_styles: {},
        bindings: {},
        event_handlers: [],
        archived: false,
        children: [],
        classes: [],
    });

    const sectionIds: string[] = [];
    const sections = layoutPlan.sections.length > 0
        ? layoutPlan.sections
        : [
            {
                type: 'hero',
                title: layoutPlan.page_name || 'Generated page',
                description: layoutPlan.page_purpose || 'Start with a clear product message and first action.',
                items: ['Primary action', 'Supporting proof'],
                columns: 2,
                cta_label: 'Continue',
                media: 'image',
                emphasis: 'primary',
            } satisfies UiBuilderLayoutSection,
        ];

    sections.forEach((section) => {
        const sectionBlock = createSectionShell(writer, section, root.id);
        createSectionContent(writer, section, sectionBlock);
        sectionIds.push(sectionBlock.id);
    });

    writer.updateChildren(root.id, sectionIds);
    return writer.getBlocks();
}
