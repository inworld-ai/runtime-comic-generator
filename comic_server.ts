import 'dotenv/config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import cors from 'cors';
import {
  GraphBuilder,
  CustomNode,
  ProcessContext,
  RemoteLLMChatNode,
  Graph
} from '@inworld/runtime/graph';
import { GraphTypes } from '@inworld/runtime/common';
import { ComicStoryGeneratorNode, parseComicStoryResponse, ComicStoryInput } from './comic_story_node';
import { ComicImageGeneratorNode, ComicImageOutput } from './comic_image_node';

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public')); // Will serve comic UI

// In-memory storage for comic generation requests
interface ComicRequest {
  id: string;
  character1Description: string;
  character2Description: string;
  artStyle: string;
  theme?: string;
  status: 'pending' | 'generating_story' | 'generating_images' | 'completed' | 'error';
  result?: ComicImageOutput;
  error?: string;
  createdAt: Date;
}

const requests: { [key: string]: ComicRequest } = {};

// Create a parser node to convert LLM response to ComicStoryOutput
class ComicResponseParserNode extends CustomNode {
  process(context: ProcessContext, input: GraphTypes.Content) {
    console.log('🔄 Parsing LLM response for comic story...');
    return parseComicStoryResponse(input.content);
  }
}

// Initialize the comic generation graph
let comicGeneratorGraph: Graph | null = null;

async function initializeGraph() {
  try {
    console.log('🔧 Initializing Comic Generator Graph...');
    
    const graphBuilder = new GraphBuilder({ 
      id: 'comic_generator',
      apiKey: process.env.INWORLD_API_KEY!
    });
    
    // Create the nodes
    const storyGeneratorNode = new ComicStoryGeneratorNode();

    const llmChatNode = new RemoteLLMChatNode({
      provider: 'openai',
      modelName: 'gpt-5-mini',
      stream: false,
    });

    const responseParserNode = new ComicResponseParserNode();

    const imageGeneratorNode = new ComicImageGeneratorNode();

    // Add nodes to graph
    graphBuilder
      .addNode(storyGeneratorNode)
      .addNode(llmChatNode)
      .addNode(responseParserNode)
      .addNode(imageGeneratorNode);

    // Create the processing chain: Story Input → LLM → Parser → Image Generation
    graphBuilder
      .addEdge(storyGeneratorNode, llmChatNode)
      .addEdge(llmChatNode, responseParserNode)
      .addEdge(responseParserNode, imageGeneratorNode)
      .setStartNode(storyGeneratorNode)
      .setEndNode(imageGeneratorNode);

    comicGeneratorGraph = graphBuilder.build();
    console.log('✅ Comic Generator Graph initialized successfully');
    
  } catch (error) {
    console.error('❌ Failed to initialize comic graph:', error);
    throw error;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'comic.html'));
});

// Generate comic endpoint
app.post('/api/generate-comic', async (req, res) => {
  try {
    const { 
      character1Description, 
      character2Description, 
      artStyle, 
      theme 
    } = req.body;
    
    // Validation
    if (!character1Description || typeof character1Description !== 'string' || character1Description.trim().length === 0) {
      return res.status(400).json({ error: 'Character 1 description is required' });
    }

    if (!character2Description || typeof character2Description !== 'string' || character2Description.trim().length === 0) {
      return res.status(400).json({ error: 'Character 2 description is required' });
    }

    if (!artStyle || typeof artStyle !== 'string' || artStyle.trim().length === 0) {
      return res.status(400).json({ error: 'Art style is required' });
    }

    if (!comicGeneratorGraph) {
      return res.status(500).json({ error: 'Comic generator is not initialized' });
    }

    // Create request
    const requestId = uuidv4();
    const request: ComicRequest = {
      id: requestId,
      character1Description: character1Description.trim(),
      character2Description: character2Description.trim(),
      artStyle: artStyle.trim(),
      theme: theme?.trim(),
      status: 'pending',
      createdAt: new Date(),
    };

    requests[requestId] = request;

    // Start generation asynchronously
    generateComic(request);

    return res.json({
      requestId,
      status: 'pending',
      message: 'Comic generation started'
    });

  } catch (error) {
    console.error('Comic generation request error:', error);
    return res.status(500).json({ error: 'Failed to start comic generation' });
  }
});

// Get comic status endpoint
app.get('/api/comic-status/:requestId', (req, res) => {
  const request = requests[req.params.requestId];
  
  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const response: any = {
    requestId: request.id,
    status: request.status,
    character1Description: request.character1Description,
    character2Description: request.character2Description,
    artStyle: request.artStyle,
    theme: request.theme,
    createdAt: request.createdAt,
  };

  if (request.status === 'completed' && request.result) {
    response.result = request.result;
  }

  if (request.status === 'error' && request.error) {
    response.error = request.error;
  }

  return res.json(response);
});

// List recent comic requests endpoint
app.get('/api/recent-comics', (req, res) => {
  const recentRequests = Object.values(requests)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10)
    .map(request => ({
      requestId: request.id,
      status: request.status,
      character1Description: request.character1Description.substring(0, 50) + '...',
      character2Description: request.character2Description.substring(0, 50) + '...',
      artStyle: request.artStyle,
      createdAt: request.createdAt,
      hasResult: !!request.result,
    }));

  return res.json(recentRequests);
});

// Function to generate comic using the graph
async function generateComic(request: ComicRequest) {
  try {
    console.log(`🎭 Starting comic generation for request ${request.id}`);
    
    request.status = 'generating_story';
    console.log('📝 Generating comic story...');

    const input: ComicStoryInput = {
      character1Description: request.character1Description,
      character2Description: request.character2Description,
      artStyle: request.artStyle,
      theme: request.theme,
    };

    const executionId = uuidv4();
    const executionResult = await comicGeneratorGraph!.start(input, { executionId });
    
    request.status = 'generating_images';
    console.log('🎨 Generating comic images...');
    
    for await (const result of executionResult.outputStream) {
      request.result = result.data as ComicImageOutput;
      request.status = 'completed';
      console.log(`✅ Comic generation completed for request ${request.id}`);
      break;
    }

    comicGeneratorGraph!.closeExecution(executionResult.outputStream);

    if (request.status !== 'completed') {
      throw new Error('No valid result received from graph execution');
    }

  } catch (error) {
    console.error(`❌ Comic generation failed for request ${request.id}:`, error);
    request.status = 'error';
    request.error = error instanceof Error ? error.message : 'Unknown error occurred';
  }
}

// Cleanup old requests (run every 2 hours)
setInterval(() => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  let deletedCount = 0;
  
  for (const [id, request] of Object.entries(requests)) {
    if (request.createdAt < twoHoursAgo) {
      delete requests[id];
      deletedCount++;
    }
  }
  
  if (deletedCount > 0) {
    console.log(`🗑️  Cleaned up ${deletedCount} old comic requests`);
  }
}, 2 * 60 * 60 * 1000); // Every 2 hours

// Start server
async function startServer() {
  try {
    // Check for required environment variables
    if (!process.env.MINIMAX_API_KEY) {
      console.error('❌ MINIMAX_API_KEY environment variable is required');
      process.exit(1);
    }

    if (!process.env.INWORLD_API_KEY) {
      console.error('❌ INWORLD_API_KEY environment variable is required');
      process.exit(1);
    }

    await initializeGraph();
    
    app.listen(PORT, () => {
      console.log(`📚 Comic Generator running on http://localhost:${PORT}`);
      console.log(`📁 Serving static files from: ${path.join(__dirname, 'public')}`);
      console.log(`🎭 Ready to create 4-panel comics!`);
    });
  } catch (error) {
    console.error('❌ Failed to start comic server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down comic server...');
  if (comicGeneratorGraph) {
    comicGeneratorGraph.stopExecutor();
    comicGeneratorGraph.cleanupAllExecutions();
    comicGeneratorGraph.destroy();
  }
  process.exit(0);
});

startServer();