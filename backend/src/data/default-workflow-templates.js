/** Default workflow task checklists for media agency automation */

export const ONE_TIME_PROJECT_STEPS = [
  { stepOrder: 1, taskName: "Lead qualification", department: "Sales", workflowStage: "pending", estimatedDays: 1 },
  { stepOrder: 2, taskName: "Requirement collection", department: "Project Management", workflowStage: "in_progress", estimatedDays: 2 },
  { stepOrder: 3, taskName: "Send quotation", department: "Sales", workflowStage: "in_progress", estimatedDays: 1 },
  { stepOrder: 4, taskName: "Confirm payment", department: "Finance", workflowStage: "review", estimatedDays: 2 },
  { stepOrder: 5, taskName: "Assign production team", department: "Project Management", workflowStage: "in_progress", estimatedDays: 1 },
  { stepOrder: 6, taskName: "Work in progress", department: "Production", workflowStage: "in_progress", estimatedDays: 5 },
  { stepOrder: 7, taskName: "Client review", department: "Project Management", workflowStage: "review", estimatedDays: 2 },
  { stepOrder: 8, taskName: "Revision", department: "Production", workflowStage: "in_progress", estimatedDays: 2 },
  { stepOrder: 9, taskName: "Final delivery", department: "Production", workflowStage: "completed", estimatedDays: 1 },
  { stepOrder: 10, taskName: "Close project", department: "Project Management", workflowStage: "completed", estimatedDays: 1 },
];

export const VIDEO_CONTENT_STEPS = [
  { stepOrder: 1, taskName: "Content planning", department: "Content Management", workflowStage: "pending" },
  { stepOrder: 2, taskName: "Script writing", department: "Content Management", workflowStage: "in_progress" },
  { stepOrder: 3, taskName: "Schedule shoot", department: "Project Management", workflowStage: "in_progress" },
  { stepOrder: 4, taskName: "Video shooting", department: "Videography", workflowStage: "in_progress" },
  { stepOrder: 5, taskName: "Transfer footage", department: "Videography", workflowStage: "in_progress" },
  { stepOrder: 6, taskName: "Video editing", department: "Video Editing", workflowStage: "in_progress" },
  { stepOrder: 7, taskName: "Internal review", department: "Content Management", workflowStage: "review" },
  { stepOrder: 8, taskName: "Client review", department: "Project Management", workflowStage: "review" },
  { stepOrder: 9, taskName: "Revision", department: "Video Editing", workflowStage: "in_progress" },
  { stepOrder: 10, taskName: "Final approval", department: "Project Management", workflowStage: "review" },
  { stepOrder: 11, taskName: "Publishing", department: "Social Media", workflowStage: "completed" },
];

export const GRAPHIC_DESIGN_STEPS = [
  { stepOrder: 1, taskName: "Creative brief", department: "Content Management", workflowStage: "pending" },
  { stepOrder: 2, taskName: "Concept design", department: "Graphic Design", workflowStage: "in_progress" },
  { stepOrder: 3, taskName: "Internal review", department: "Content Management", workflowStage: "review" },
  { stepOrder: 4, taskName: "Client review", department: "Project Management", workflowStage: "review" },
  { stepOrder: 5, taskName: "Revision", department: "Graphic Design", workflowStage: "in_progress" },
  { stepOrder: 6, taskName: "Final files delivery", department: "Graphic Design", workflowStage: "completed" },
];

export const PHOTOGRAPHY_STEPS = [
  { stepOrder: 1, taskName: "Shot list planning", department: "Content Management", workflowStage: "pending" },
  { stepOrder: 2, taskName: "Schedule shoot", department: "Project Management", workflowStage: "in_progress" },
  { stepOrder: 3, taskName: "Photography session", department: "Photography", workflowStage: "in_progress" },
  { stepOrder: 4, taskName: "Photo selection", department: "Photography", workflowStage: "review" },
  { stepOrder: 5, taskName: "Retouching", department: "Graphic Design", workflowStage: "in_progress" },
  { stepOrder: 6, taskName: "Client approval", department: "Project Management", workflowStage: "review" },
  { stepOrder: 7, taskName: "Final delivery", department: "Photography", workflowStage: "completed" },
];

export const SOCIAL_MEDIA_STEPS = [
  { stepOrder: 1, taskName: "Content planning", department: "Social Media", workflowStage: "pending" },
  { stepOrder: 2, taskName: "Copywriting", department: "Content Management", workflowStage: "in_progress" },
  { stepOrder: 3, taskName: "Visual design", department: "Graphic Design", workflowStage: "in_progress" },
  { stepOrder: 4, taskName: "Internal review", department: "Content Management", workflowStage: "review" },
  { stepOrder: 5, taskName: "Client approval", department: "Project Management", workflowStage: "review" },
  { stepOrder: 6, taskName: "Schedule post", department: "Social Media", workflowStage: "in_progress" },
  { stepOrder: 7, taskName: "Publish", department: "Social Media", workflowStage: "completed" },
];

export const MARKETING_CAMPAIGN_STEPS = [
  { stepOrder: 1, taskName: "Campaign strategy", department: "Content Management", workflowStage: "pending" },
  { stepOrder: 2, taskName: "Asset production", department: "Production", workflowStage: "in_progress" },
  { stepOrder: 3, taskName: "Channel setup", department: "Social Media", workflowStage: "in_progress" },
  { stepOrder: 4, taskName: "Launch review", department: "Project Management", workflowStage: "review" },
  { stepOrder: 5, taskName: "Campaign launch", department: "Social Media", workflowStage: "completed" },
  { stepOrder: 6, taskName: "Performance report", department: "Content Management", workflowStage: "completed" },
];

export const DEFAULT_WORKFLOW_TEMPLATES = [
  {
    name: "One-Time Project Workflow",
    description: "Standard workflow for single-project clients",
    clientType: "ONE_TIME",
    contentType: null,
    isDefault: true,
    steps: ONE_TIME_PROJECT_STEPS,
  },
  {
    name: "Video Production",
    description: "Full video production checklist",
    clientType: null,
    contentType: "VIDEO",
    isDefault: true,
    steps: VIDEO_CONTENT_STEPS,
  },
  {
    name: "Graphic Design",
    description: "Graphic design delivery workflow",
    clientType: null,
    contentType: "GRAPHIC_DESIGN",
    isDefault: true,
    steps: GRAPHIC_DESIGN_STEPS,
  },
  {
    name: "Photography",
    description: "Photography session workflow",
    clientType: null,
    contentType: "PHOTOGRAPHY",
    isDefault: true,
    steps: PHOTOGRAPHY_STEPS,
  },
  {
    name: "Social Media Post",
    description: "Social media content workflow",
    clientType: null,
    contentType: "SOCIAL_MEDIA_POST",
    isDefault: true,
    steps: SOCIAL_MEDIA_STEPS,
  },
  {
    name: "Marketing Campaign",
    description: "Multi-channel campaign workflow",
    clientType: null,
    contentType: "MARKETING_CAMPAIGN",
    isDefault: true,
    steps: MARKETING_CAMPAIGN_STEPS,
  },
];
