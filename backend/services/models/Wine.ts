export interface GrapeVariety {
    name: string;
    percentage?: number;
}

export interface Wine {
    id: string;
    name: string;
    type: string;
    region: string;
    country: string;
    vintage: number;
    brand: string;
    varietal: string;
    alcoholContent: number;
    body: string;
    sweetness: string;
    tannin: string;
    acidity: string;
    foodPairings: string[];
    aromas: string[];
    price: number;
    currency: string;
    description: string;
    imageUrl: string;
    grapeVarieties?: GrapeVariety[];
}