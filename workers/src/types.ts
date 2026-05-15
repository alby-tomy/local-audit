export type AuditIssue = {
  id: string;
  name?: string;
  description?: string;
  score_penalty?: number;
};

export type AuditJobPayload = {
  auditId: string;
  tenantId: string;
  websiteUrl: string;
};

export type FixJobPayload = {
  auditId: string;
  tenantId: string;
  issue: AuditIssue;
  html?: string;
};

export type DeliveryJobPayload = {
  auditId: string;
  tenantId: string;
  clientEmail: string;
};
