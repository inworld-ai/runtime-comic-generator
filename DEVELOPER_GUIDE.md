# Comic Generator - Developer Guide

## Architecture Overview

The comic generator uses the Inworld Runtime SDK (v0.5.0) to create a graph-based processing pipeline that transforms user input into complete comics through multiple AI processing stages.

### Processing Pipeline

```
User Input → Story Generator → LLM (Gemini) → Response Parser → Image Generator (Minimax) → Final Comic
```

1. **Story Generator**: Creates structured prompts for the LLM
2. **LLM Chat Node**: Uses Google Gemini to generate comic story with dialogue and visual descriptions
3. **Response Parser**: Converts LLM response into structured comic data
4. **Image Generator**: Uses Minimax API to generate images for each panel

## Project Structure

```
image_generator/
├── comic_server.ts           # Main server with graph orchestration
├── comic_story_node.ts       # Custom node for story prompt generation
├── comic_image_node.ts       # Custom node for image generation via Minimax
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── public/                   # Static assets (HTML UI)
    └── imagegen.html         # Web interface for testing
```

## Core Components

### 1. Comic Story Generator Node (`comic_story_node.ts`)

Custom node that extends `CustomNode` to create structured prompts for comic generation.

**Input**: `ComicStoryInput`
```typescript
interface ComicStoryInput {
  character1Description: string;
  character2Description: string;
  artStyle: string;
  theme?: string;
}
```

**Output**: `GraphTypes.LLMChatRequest` - Formatted prompt for the LLM

**Key Features**:
- Generates detailed prompts that ensure 4-panel structure
- Includes specific JSON formatting requirements
- Provides guidelines for visual descriptions and dialogue

### 2. Comic Image Generator Node (`comic_image_node.ts`)

Handles the image generation for all 4 comic panels using the Minimax API.

**Input**: `ComicStoryOutput` - Structured comic story data
**Output**: `ComicImageOutput` - Comic with generated image URLs

**Key Features**:
- Parallel processing of all 4 panels
- Retry logic with exponential backoff
- Enhanced prompts for comic-style imagery
- Error handling for individual panel failures

### 3. Response Parser Node

Converts the LLM's JSON response into structured `ComicStoryOutput` format.

**Features**:
- Cleans markdown formatting from LLM responses
- Validates panel structure and count
- Provides fallback error comic for parsing failures
- Ensures consistent panel numbering

## API Endpoints

### Comic Generation

**POST** `/api/generate-comic`

Generate a new 4-panel comic strip.

**Request Body**:
```json
{
  "character1Description": "A brave knight with a shiny sword",
  "character2Description": "A wise old wizard with a long beard", 
  "artStyle": "anime manga style",
  "theme": "medieval adventure"
}
```

**Response**:
```json
{
  "requestId": "uuid",
  "status": "pending",
  "message": "Comic generation started"
}
```

### Status Check

**GET** `/api/comic-status/:requestId`

Check the status of a comic generation request.

**Response** (when completed):
```json
{
  "requestId": "uuid",
  "status": "completed", 
  "result": {
    "title": "The Knight and the Wizard",
    "panels": [
      {
        "panelNumber": 1,
        "dialogueText": "Hello, wise wizard!",
        "visualDescription": "A knight approaches a wizard...",
        "imageUrl": "https://generated-image-url.com/panel1.jpg"
      }
      // ... 3 more panels
    ],
    "artStyle": "anime manga style"
  }
}
```

### Recent Comics

**GET** `/api/recent-comics`

List the 10 most recent comic generation requests.

## Graph Architecture (Inworld Runtime v0.5.0)

The application uses the latest Inworld Runtime patterns:

### Custom Node Pattern
```typescript
class CustomComicNode extends CustomNode {
  process(context: ProcessContext, input: InputType): OutputType {
    // Processing logic
    return output;
  }
}
```

### Graph Construction
```typescript
const graphBuilder = new GraphBuilder({ 
  id: 'comic_generator',
  apiKey: process.env.INWORLD_API_KEY!
});

const executor = graphBuilder
  .addNode(node1)
  .addNode(node2)
  .addEdge(node1, node2)
  .setStartNode(node1)
  .setEndNode(node2)
  .build();
```

### Execution Pattern
```typescript
const executionId = uuidv4();
const outputStream = await executor.start(input, executionId);

for await (const result of outputStream) {
  if (result.nodeId === 'target-node-id') {
    // Handle result
    break;
  }
}

executor.closeExecution(outputStream);
```

## Error Handling

- **Request Validation**: Validates character descriptions, art styles, and input formats
- **API Failures**: Implements retry logic for both LLM and image generation APIs
- **Parsing Errors**: Provides fallback comics when LLM output cannot be parsed
- **Partial Failures**: Allows comics to be returned even if some panels fail to generate images
- **Timeout Management**: 2-minute timeouts for image generation requests

## Alternative Simple Server

The project also includes `server.ts` - a simpler image generation server that demonstrates basic Minimax API integration without the full comic generation pipeline. This server provides a single endpoint for generating images from text prompts and can be useful for testing or simpler use cases.

To run the simple server instead:
```bash
# Edit package.json to change main script, or run directly:
npx ts-node server.ts
```

