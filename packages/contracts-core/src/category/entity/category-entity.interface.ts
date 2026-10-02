export interface CategoryEntityInterface {
  id: number;
  slug: string;
  parentCategoryId: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
