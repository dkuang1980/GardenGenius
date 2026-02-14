
export enum GardenStyle {
  MODERN = 'Modern Minimalist',
  TRADITIONAL = 'Traditional English',
  ZEN = 'Japanese Zen',
  MEDITERRANEAN = 'Mediterranean',
  TROPICAL = 'Tropical Lush',
  DESERT = 'Modern Desert',
  COTTAGE = 'English Cottage'
}

export enum DesignComplexity {
  SIMPLE = 'Simple & Low Maintenance',
  BALANCED = 'Balanced & Practical',
  PREMIUM = 'Luxury & High-End'
}

export interface DesignProject {
  id: string;
  name: string;
  originalImage: string;
  referenceImage?: string;
  currentImage: string;
  style: GardenStyle;
  complexity: DesignComplexity;
  history: ChatMessage[];
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

export interface DesignPreferences {
  lighting: string;
  plants: string[];
  features: string[];
}
