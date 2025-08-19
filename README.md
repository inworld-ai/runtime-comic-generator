# Inworld Runtime Template using Minimax API

This app demonstrates four-panel-comic generation using the Inworld Runtime and the Minimax Image Generation API. [Check out our video](https://www.youtube.com/watch?v=QJufvjcC85c) for a walkthrough of this demo, our read through the [Developer Guide](https://github.com/inworld-ai/runtime-comic-generator/blob/main/DEVELOPER_GUIDE.md) in this repository.

## Local Development
To use the Inworld Runtime and the Minimax API, you'll need to populate a `.env` file with a `MINIMAX_API_KEY` and an `INWORLD_API_KEY`. Example:

```
MINIMAX_API_KEY=123
INWORLD_API_KEY=456
```
You can request a Minimax API key [here](https://www.minimax.io/platform/user-center/basic-information/interface-key) and an Inworld API key [here](https://docs.inworld.ai/docs/node/authentication#runtime-api-key).

To properly install dependencies, navigate to the base directory and run `yarn`. Run `yarn start` to start the app, and open your browser and navigate to http://localhost:3003 to access the comic generation interface.

## Architecture Overview

The comic generator uses the Inworld Runtime SDK to create a graph-based processing pipeline that transforms user input into complete comics through multiple AI processing stages.

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

### Comic Story Generator Node (`comic_story_node.ts`)

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

### Comic Image Generator Node (`comic_image_node.ts`)

Handles the image generation for all 4 comic panels using the Minimax API.

**Input**: `ComicStoryOutput` - Structured comic story data
**Output**: `ComicImageOutput` - Comic with generated image URLs

### Response Parser Node

Converts the LLM's JSON response into structured `ComicStoryOutput` format.

**Features**:
- Cleans markdown formatting from LLM responses
- Validates panel structure and count
- Provides fallback error comic for parsing failures
- Ensures consistent panel numbering

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


## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.