import { CustomNode, ProcessContext } from '@inworld/runtime/graph';
import { GraphTypes } from '@inworld/runtime/common';

// Input interface for comic story generation
export interface ComicStoryInput {
  character1Description: string;
  character2Description: string;
  artStyle: string;
  theme?: string; // Optional theme/setting
}

// Output interface for comic panels
export interface ComicPanel {
  panelNumber: number;
  dialogueText: string;
  visualDescription: string;
}

export interface ComicStoryOutput {
  panels: ComicPanel[];
  artStyle: string;
  title?: string;
}

// Custom Comic Story Generation node
export class ComicStoryGeneratorNode extends CustomNode {
  process(
    _context: ProcessContext,
    input: ComicStoryInput
  ): GraphTypes.LLMChatRequest {
    console.log(
      `📝 Generating comic story for characters: "${input.character1Description}" and "${input.character2Description}"`
    );

    const prompt = `You are a comic book writer. Create a 4-panel comic story with the following characters and specifications:

CHARACTER 1: ${input.character1Description}
CHARACTER 2: ${input.character2Description}
ART STYLE: ${input.artStyle}
${input.theme ? `THEME/SETTING: ${input.theme}` : ''}

Create exactly 4 panels for a short comic strip. For each panel, provide:
1. Any dialogue or text that should appear in the panel
2. A detailed visual description for the image generation

Format your response as a JSON object with this exact structure:
{
  "title": "A catchy title for the comic",
  "panels": [
    {
      "panelNumber": 1,
      "dialogueText": "Text spoken by characters in this panel",
      "visualDescription": "Detailed description of what should be drawn in this panel, including character positions, actions, expressions, background, and artistic style"
    },
    ... (repeat for panels 2, 3, 4)
  ]
}

Guidelines:
- Each visual description should be detailed enough for image generation
- Include the art style (${input.artStyle}) in each visual description
- Make sure the story flows logically across the 4 panels
- Keep dialogue concise and appropriate for comic bubbles
- Describe character expressions and body language
- Include background/setting details
- Make it engaging and complete in just 4 panels
- Only one character should speak in each panel, but both characters can be present
- Do not include speech bubbles in the visual descriptions!

IMPORTANT: Return ONLY the JSON object, no additional text or formatting.`;

    return new GraphTypes.LLMChatRequest({
      messages: [{ role: 'user', content: prompt }],
    });
  }
}

// Helper function to parse LLM response into ComicStoryOutput
export function parseComicStoryResponse(llmResponse: string): ComicStoryOutput {
  try {
    // Clean the response - remove any markdown formatting or extra text
    let cleanResponse = llmResponse.trim();

    // Remove markdown code blocks if present
    if (cleanResponse.startsWith('```json')) {
      cleanResponse = cleanResponse
        .replace(/```json\s*/, '')
        .replace(/```\s*$/, '');
    } else if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse
        .replace(/```\s*/, '')
        .replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(cleanResponse);

    console.log('🔄 Successfully parsed comic story response:', parsed);

    // Validate the structure
    if (!parsed.panels || !Array.isArray(parsed.panels)) {
      throw new Error('Invalid response: panels array missing');
    }

    if (parsed.panels.length !== 4) {
      throw new Error(`Expected 4 panels, got ${parsed.panels.length}`);
    }

    // Validate each panel
    parsed.panels.forEach((panel: ComicPanel, index: number) => {
      if (!panel.dialogueText && panel.dialogueText !== '') {
        throw new Error(`Panel ${index + 1}: missing dialogueText`);
      }
      if (!panel.visualDescription) {
        throw new Error(`Panel ${index + 1}: missing visualDescription`);
      }
      // Ensure panelNumber is set correctly
      panel.panelNumber = index + 1;
    });

    const result: ComicStoryOutput = {
      panels: parsed.panels,
      artStyle: parsed.artStyle || 'comic book style',
      title: parsed.title || 'Untitled Comic',
    };

    console.log(
      `✅ Successfully parsed comic story with ${result.panels.length} panels`
    );
    return result;
  } catch (error) {
    console.error('❌ Failed to parse comic story response:', error);
    console.error('Raw response:', llmResponse);

    // Fallback: create a simple error comic
    return {
      panels: [
        {
          panelNumber: 1,
          dialogueText: 'Error generating comic story',
          visualDescription:
            'A simple illustration showing an error message, drawn in comic book style',
        },
        {
          panelNumber: 2,
          dialogueText: 'Please try again',
          visualDescription:
            'A character looking confused, drawn in comic book style',
        },
        {
          panelNumber: 3,
          dialogueText: 'Check your input',
          visualDescription:
            'A character pointing at the viewer, drawn in comic book style',
        },
        {
          panelNumber: 4,
          dialogueText: 'Thank you!',
          visualDescription:
            'A character waving goodbye, drawn in comic book style',
        },
      ],
      artStyle: 'comic book style',
      title: 'Error Comic',
    };
  }
}
