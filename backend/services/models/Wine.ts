export interface Wine {
  id: string;
  name: string;
  type: string;
  year?: number;
  region?: string;
  description?: string;
  price?: number;
  rating?: number;
}