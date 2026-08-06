export type AiOrganizerConfig = {
  scope: "all" | "folder";
  folderId: number | null;
  locale: "zh-CN" | "en-US";
  folderCount: number;
  referenceExistingFolders: boolean;
  instructions: string;
  confidenceThreshold: number;
  batchSize: number;
};

export type AiOrganizerTaxonomyItem = {
  key: string;
  name: string;
  description: string;
  include: string;
  exclude: string;
};

export type AiOrganizerAssignment = {
  itemKey: string;
  videoId: number;
  folderKey: string;
  confidence: number;
  lowConfidence: boolean;
  reason: string;
};

export declare function normalizeAiOrganizerConfig(raw: unknown): AiOrganizerConfig;
export declare function normalizeAiOrganizerTaxonomy(payload: unknown, expectedCount?: number): AiOrganizerTaxonomyItem[];
export declare function resolveAiOrganizerFolderNames(
  taxonomy: AiOrganizerTaxonomyItem[],
  existingFolders: Array<{ name?: unknown; deletedAt?: unknown }>,
  reviewFolderName?: string,
): { taxonomy: AiOrganizerTaxonomyItem[]; reviewFolderName: string };
export declare function normalizeAiOrganizerAssignments(
  payload: unknown,
  expectedItems: Array<{ itemKey: string; videoId: number }>,
  taxonomy: AiOrganizerTaxonomyItem[],
  confidenceThreshold?: number,
): { assignments: AiOrganizerAssignment[]; invalid: number };
export declare function buildAiOrganizerTaxonomyPrompt(options: Record<string, unknown>): string;
export declare function buildAiOrganizerClassificationPrompt(options: Record<string, unknown>): string;
export declare function applyAiOrganizerPlan(state: any, plan: Record<string, unknown>, nowValue?: number): {
  state: any;
  summary: Record<string, number>;
  undo: Record<string, unknown>;
};
export declare function undoAiOrganizerPlan(state: any, undo: Record<string, any>, nowValue?: number): {
  state: any;
  summary: Record<string, number>;
};
export declare const REVIEW_FOLDER_KEY: "__review__";
