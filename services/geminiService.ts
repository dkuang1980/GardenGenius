
import { GoogleGenAI, Type } from "@google/genai";
import { DesignComplexity } from "../types";

export const detectObjects = async (imageBase64: string): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';

  const response = await ai.models.generateContent({
    model,
    contents: [{
      parts: [
        {
          inlineData: {
            data: imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64,
            mimeType: 'image/png',
          },
        },
        {
          text: "Identify only the unique, specific vegetation or functional features in this yard photo that a homeowner might want to explicitly choose to keep, hide, or replace (e.g., 'Japanese Maple Tree', 'Stone Statue', 'Ornamental Fountain', 'Utility Box', 'AC Unit', 'Electrical Box', 'Specific Large Rose Bush', 'Old Oak Tree'). IGNORE permanent architectural elements like 'House', 'Main Building', 'Driveway', 'Sidewalk', 'Garage', and 'Fence' as these are considered permanent. Return a JSON array of short, descriptive strings."
        }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse object detection results", e);
    return [];
  }
};

export const generateLandscapeDesign = async (
  baseImageBase64: string,
  prompt: string,
  referenceImageBase64?: string,
  style?: string,
  objectsToKeep: string[] = [],
  complexity: DesignComplexity = DesignComplexity.BALANCED
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  const parts: any[] = [
    {
      inlineData: {
        data: baseImageBase64.includes(',') ? baseImageBase64.split(',')[1] : baseImageBase64,
        mimeType: 'image/png',
      },
    }
  ];

  if (referenceImageBase64) {
    parts.push({
      inlineData: {
        data: referenceImageBase64.includes(',') ? referenceImageBase64.split(',')[1] : referenceImageBase64,
        mimeType: 'image/png',
      },
    });
  }

  const keepInstruction = objectsToKeep.length > 0 
    ? `Additionally, you MUST preserve the following specific unique features exactly as they appear: ${objectsToKeep.join(', ')}.` 
    : "";

  let complexityInstruction = "";
  if (complexity === DesignComplexity.SIMPLE) {
    complexityInstruction = "TRANSFORMATION LEVEL: MINIMAL (LEAST DESTRUCTIVE). Keep existing layout and beds. Only refresh plants and clean edges. Do not remove major existing trees or non-architectural structures unless strictly necessary.";
  } else if (complexity === DesignComplexity.PREMIUM) {
    complexityInstruction = "TRANSFORMATION LEVEL: MAXIMUM (TRANSFORMATIVE). Full creative freedom to overhaul layout, add hardscapes (stone patios, fire pits, water features), and create multi-layered high-end planting zones.";
  } else {
    complexityInstruction = "TRANSFORMATION LEVEL: MODERATE (BALANCED). Upgrade plant palette, refine bed shapes, and introduce high-quality materials while respecting the general flow of the existing space.";
  }

  parts.push({
    text: `You are a world-class senior landscape architect with decades of experience. Redesign the yard in the provided base image based on these instructions: ${prompt}. ${style ? `The style must be ${style}.` : ''} 
    
    ${complexityInstruction}

    STRICT ARCHITECTURAL BOUNDARIES: 
    - MANDATORY: The House, Main Building, Garage, Driveway, Sidewalks, and Fencing MUST be preserved exactly as they are. DO NOT MODIFY, REPLACE, OR OVERLAP THEM.
    - NO ENCROACHMENT: Under no circumstances should plants, mulch, grass, or soil appear on top of the driveway, garage floor, or sidewalks. These functional surfaces must remain 100% clear.
    - CLEAN EDGING: All planting beds must have sharp, professional edging separating them from lawn or hardscape.

    EXPERT LANDSCAPING PRINCIPLES:
    1. LAYERED PLANTING: Use the 'Short-Medium-Tall' principle. Place low groundcovers at the front, medium perennials/shrubs in the middle, and taller specimens/privacy screens at the back or against the house.
    2. SCREENING: If utility boxes, AC units, or trash areas are visible and NOT in the 'keep' list, screen them elegantly with evergreen shrubs or ornamental grasses.
    3. SCALE & PROPORTION: Select plants that complement the house's height. Do not block windows with trees unless they are specifically 'airy' species.
    4. MATERIAL REALISM: Use realistic textures for mulch (bark/dark), stone (river rock/slate), and paving. Ensure lighting and shadows on new elements match the time of day in the original photo.
    5. FOUNDATION PLANTING: Ensure plants near the house foundation look anchored and natural, not floating.
    
    ${keepInstruction}

    TECHNICAL INSTRUCTIONS:
    - PERSERVE PERSPECTIVE: Maintain the exact camera angle, zoom, and framing.
    - NO CROPPING: Do not change the image aspect ratio or dimensions.
    
    Return ONLY the modified image that matches the input's framing perfectly.`
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ parts }],
  });

  if (!response?.candidates?.[0]?.content?.parts) {
    throw new Error("The AI Architect could not generate a design. Please try a different photo or description.");
  }
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("No image data found in the response.");
};

export const chatWithArchitect = async (
  history: { role: 'user' | 'assistant'; content: string }[],
  latestImage: string,
  userMessage: string
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  const model = 'gemini-3-flash-preview';
  
  const chatContext = history.map(h => `${h.role === 'user' ? 'Client' : 'Architect'}: ${h.content}`).join('\n');
  
  const response = await ai.models.generateContent({
    model,
    contents: [{
      parts: [
        { inlineData: { data: latestImage.includes(',') ? latestImage.split(',')[1] : latestImage, mimeType: 'image/png' } },
        { text: `System: You are a Senior Landscape Architecture Consultant. You analyze designs based on horticultural standards, spatial flow, and curb appeal. 
            When the user asks for changes, provide expert insights (e.g., 'By adding these evergreens here, we create year-round structure').
            Current Design context: ${chatContext}
            User Input: ${userMessage}
            
            Provide a professional, knowledgeable, and encouraging response. If the user asks for something that violates architectural safety or standard design logic, gently advise them on a better alternative.` }
      ]
    }]
  });

  return response.text || "I'm here to refine your vision with professional architectural standards. How can we improve this space?";
};
