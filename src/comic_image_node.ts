import axios from 'axios';
import { CustomNode, ProcessContext } from '@inworld/runtime/graph';
import { ComicStoryOutput } from './comic_story_node';

// Output interface for generated comic images
export interface ComicImageOutput {
  title: string;
  panels: Array<{
    panelNumber: number;
    dialogueText: string;
    visualDescription: string;
    imageUrl: string;
  }>;
  artStyle: string;
}

// Custom Comic Image Generation node
export class ComicImageGeneratorNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: ComicStoryOutput
  ): Promise<ComicImageOutput> {
    try {
      console.log(`🎨 Generating 4 comic panel images for: "${input.title}"`);

      const apiKey = process.env.MINIMAX_API_KEY;
      if (!apiKey) {
        throw new Error('MINIMAX_API_KEY environment variable is required');
      }

      const url = 'https://api.minimax.io/v1/image_generation';
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      // Generate all panel images in parallel
      const imagePromises = input.panels.map(async (panel) => {
        console.log(
          `🖼️  Starting image generation for panel ${panel.panelNumber}...`
        );

        // Enhanced prompt for comic-style image generation
        const enhancedPrompt = `${panel.visualDescription}, ${input.artStyle}, clean composition`;

        const payload = {
          model: 'image-01',
          prompt: enhancedPrompt,
          width: 512,
          height: 512,
          response_format: 'url',
          n: 1, // One image per panel
          prompt_optimizer: true,
        };

        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
          try {
            const timeoutMs = 120000; // 2 minutes
            console.log(
              `🔄 Attempt ${attempt + 1}/${maxRetries} for panel ${panel.panelNumber}`
            );

            const response = await axios.post(url, payload, {
              headers,
              timeout: timeoutMs,
            });

            if (!response.data || !response.data.base_resp) {
              throw new Error(`Invalid response from MiniMax API`);
            }

            if (!response.data.data || !response.data.data.image_urls) {
              throw new Error(
                `No images received from MiniMax API. Status Code: ${response.data.base_resp.status_code}, Status Message: ${response.data.base_resp.status_msg}`
              );
            }

            const imageUrl = response.data.data.image_urls[0];
            if (!imageUrl) {
              throw new Error(
                `No image URL received from MiniMax API. Status Code: ${response.data.base_resp.status_code}, Status Message: ${response.data.base_resp.status_msg}`
              );
            }

            console.log(`✅ Generated image for panel ${panel.panelNumber}`);

            return {
              panelNumber: panel.panelNumber,
              dialogueText: panel.dialogueText,
              visualDescription: panel.visualDescription,
              imageUrl: imageUrl,
            };
          } catch (panelError) {
            attempt++;
            console.error(
              `❌ Attempt ${attempt} failed for panel ${panel.panelNumber}:`,
              panelError
            );

            if (attempt >= maxRetries) {
              console.error(
                `❌ All ${maxRetries} attempts failed for panel ${panel.panelNumber}`
              );
              break;
            } else {
              // Wait before retry with exponential backoff
              const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
              console.log(`⏳ Waiting ${delay}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        // Return placeholder for failed panels after all retries
        return {
          panelNumber: panel.panelNumber,
          dialogueText: panel.dialogueText,
          visualDescription: panel.visualDescription,
          imageUrl: '', // Empty URL indicates failure
        };
      });

      // Wait for all panels to complete (or fail)
      const panelResults = await Promise.allSettled(imagePromises);

      // Extract results from Promise.allSettled
      const panels = panelResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Panel ${index + 1} promise rejected:`, result.reason);
          return {
            panelNumber: index + 1,
            dialogueText: input.panels[index].dialogueText,
            visualDescription: input.panels[index].visualDescription,
            imageUrl: '',
          };
        }
      });

      const result: ComicImageOutput = {
        title: input.title || 'Untitled Comic',
        panels: panels,
        artStyle: input.artStyle,
      };

      const successfulPanels = panels.filter((p) => p && p.imageUrl).length;
      console.log(
        `🎉 Comic generation completed: ${successfulPanels}/4 panels generated successfully`
      );

      return result;
    } catch (error) {
      console.error('❌ Comic image generation error:', error);
      throw error;
    }
  }
}

// Helper function to validate comic image output
export function validateComicImageOutput(output: ComicImageOutput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!output.title) {
    errors.push('Missing comic title');
  }

  if (!output.panels || !Array.isArray(output.panels)) {
    errors.push('Missing or invalid panels array');
    return { isValid: false, errors };
  }

  if (output.panels.length !== 4) {
    errors.push(`Expected 4 panels, got ${output.panels.length}`);
  }

  output.panels.forEach((panel, index) => {
    if (!panel.imageUrl) {
      errors.push(`Panel ${index + 1}: missing image URL`);
    }
    if (!panel.visualDescription) {
      errors.push(`Panel ${index + 1}: missing visual description`);
    }
    if (panel.panelNumber !== index + 1) {
      errors.push(`Panel ${index + 1}: incorrect panel number`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
