import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma.js";

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") {
    return (value as T) ?? fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function toPageSchema(page: any) {
  const meta = parseJsonValue<Record<string, unknown>>(page.meta, {});

  return {
    id: page.id,
    name: page.name,
    path: page.path,
    root_block_id: typeof meta.root_block_id === "string" ? meta.root_block_id : undefined,
    is_dynamic: page.isDynamic || false,
    meta,
    archived: page.archived || false,
  };
}

export async function getPageContent(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const page = await prisma.page.findUnique({
      where: { id: id as string },
      select: { id: true, idRoot: true },
    });

    if (!page) {
      return res.status(404).json({ error: "Page not found" });
    }

    const blocks = await prisma.block.findMany({
      where: { pageId: page.idRoot },
      orderBy: { order: "asc" },
    });

    const serializedBlocks = blocks.map((b) => ({
      id: b.id,
      block_type: b.blockType,
      name: b.name,
      parent_id: b.parentId,
      page_id: page.id,
      properties: parseJsonValue<Record<string, unknown>>(b.properties, {}),
      styles: parseJsonValue<Record<string, string | number | boolean>>(b.styles, {}),
      responsive_styles: parseJsonValue<Record<string, Record<string, string | number | boolean>>>(b.responsiveStyles, {}),
      classes: parseJsonValue<string[]>(b.classes, []),
      event_handlers: parseJsonValue<any[]>(b.events, []),
      bindings: parseJsonValue<Record<string, unknown>>(b.bindings, {}),
      children: parseJsonValue<string[]>(b.children, []),
      order: b.order,
      archived: b.archived,
    }));

    res.json({ content: JSON.stringify(serializedBlocks) });
  } catch (error) {
    console.error("Error getting page content:", error);
    res.status(500).json({ error: "Failed to get page content" });
  }
}

export async function listPages(req: Request, res: Response) {
  res.json([]);
}

export async function createPage(req: Request, res: Response) {
  try {
    const { name, path, projectId } = req.body;
    if (!projectId)
      return res.status(400).json({ error: "projectId required" });

    const page = await prisma.page.create({
      data: {
        id: randomUUID(),
        project: { connect: { id: projectId } },
        name: name || "New Page",
        path: path || "/new-page",
      },
    });

    const rootBlock = await prisma.block.create({
      data: {
        projectId,
        pageId: page.idRoot,
        parentId: null,
        blockType: "canvas",
        name: "Page Root",
        properties: JSON.stringify({}),
        styles: JSON.stringify({}),
        responsiveStyles: JSON.stringify({}),
        classes: JSON.stringify([]),
        events: JSON.stringify([]),
        bindings: JSON.stringify({}),
        children: JSON.stringify([]),
        order: 0,
      },
    });

    const updatedPage = await prisma.page.update({
      where: { id: page.id },
      data: {
        meta: JSON.stringify({
          root_block_id: rootBlock.id,
        }),
      },
    });

    res.json(toPageSchema(updatedPage));
  } catch (error) {
    console.error("Error creating page:", error);
    res.status(500).json({ error: "Failed" });
  }
}

export async function archivePage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const page = await prisma.page.update({
      where: { id: id as string },
      data: { archived: true },
    });
    res.json(toPageSchema(page));
  } catch (error) {
    console.error("Error archiving page:", error);
    res.status(500).json({ error: "Failed to archive page" });
  }
}

export async function updatePage(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, path } = req.body;
    const page = await prisma.page.update({
      where: { id: id as string },
      data: { name, path },
    });
    res.json(toPageSchema(page));
  } catch (error) {
    console.error("Error updating page:", error);
    res.status(500).json({ error: "Failed to update page" });
  }
}
