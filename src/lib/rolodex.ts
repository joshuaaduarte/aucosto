export const RELATION_TYPES = [
  "spouse", "partner", "pet_of", "parent", "child", "sibling",
  "friend", "coworker", "manager", "reports_to", "works_at", "knows", "other",
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface RolodexRelation {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  label: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  toEntityName?: string;
  fromEntityName?: string;
}
