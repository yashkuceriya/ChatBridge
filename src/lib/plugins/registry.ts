import type { AppManifest, ToolDefinition } from "@/types";

// In-memory registry for development; backed by DB in production
const registeredApps = new Map<string, AppManifest>();

export function registerApp(manifest: AppManifest): void {
  registeredApps.set(manifest.appId, manifest);
}

export function getApp(appId: string): AppManifest | undefined {
  return registeredApps.get(appId);
}

export function getAllApps(): AppManifest[] {
  return Array.from(registeredApps.values());
}

export function getActiveApps(enabledAppIds?: string[]): AppManifest[] {
  const apps = getAllApps().filter((app) => app.reviewStatus === "approved");
  if (enabledAppIds) {
    return apps.filter((app) => enabledAppIds.includes(app.appId));
  }
  return apps;
}

export function getToolsForApp(appId: string): ToolDefinition[] {
  const app = getApp(appId);
  return app?.tools ?? [];
}

export function findAppByToolName(toolName: string): AppManifest | undefined {
  for (const app of registeredApps.values()) {
    if (app.tools.some((t) => t.name === toolName)) {
      return app;
    }
  }
  return undefined;
}

// --- Built-in App Registrations ---

export function registerBuiltinApps(): void {
  registerApp({
    appId: "chess",
    name: "Chess",
    version: "1.0.0",
    description: "Interactive chess game with AI analysis support",
    ui: {
      entrypointUrl: "/apps/chess",
      sandboxProfile: "allow-scripts allow-same-origin",
    },
    tools: [
      {
        name: "chess_start_game",
        description: "Start a new chess game",
        parameters: {
          type: "object",
          properties: {
            color: {
              type: "string",
              enum: ["white", "black"],
              description: "The color the student plays as",
            },
          },
          required: ["color"],
        },
      },
      {
        name: "chess_make_move",
        description: "Make a chess move in algebraic notation",
        parameters: {
          type: "object",
          properties: {
            move: {
              type: "string",
              description: "Move in algebraic notation (e.g., e2e4, Nf3)",
            },
          },
          required: ["move"],
        },
      },
      {
        name: "chess_get_hint",
        description: "Get a hint for the current chess position",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "chess_get_game_status",
        description:
          "Get the current chess game status including board position, whose turn it is, material balance, and legal moves. Use this when the student asks about the game state or needs help deciding a move.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "chess_resign",
        description: "Resign the current chess game",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ],
    permissions: ["chat_context_read"],
    auth: "none",
    reviewStatus: "approved",
    icon: "♟",
  });

  registerApp({
    appId: "tictactoe",
    name: "Tic Tac Toe",
    version: "1.0.0",
    description: "Classic Tic Tac Toe game for learning strategy and logical thinking",
    ui: {
      entrypointUrl: "/apps/tictactoe",
      sandboxProfile: "allow-scripts allow-same-origin",
    },
    tools: [
      {
        name: "tictactoe_start_game",
        description: "Start a new Tic Tac Toe game",
        parameters: {
          type: "object",
          properties: {
            marker: {
              type: "string",
              enum: ["X", "O"],
              description: "The marker the student plays as (X goes first)",
            },
            difficulty: {
              type: "string",
              enum: ["easy", "medium", "hard"],
              description: "AI difficulty level. Default medium.",
            },
          },
          required: ["marker"],
        },
      },
      {
        name: "tictactoe_make_move",
        description: "Make a move on the Tic Tac Toe board",
        parameters: {
          type: "object",
          properties: {
            position: {
              type: "number",
              description: "Board position 0-8 (top-left=0, top-center=1, ... bottom-right=8)",
            },
          },
          required: ["position"],
        },
      },
      {
        name: "tictactoe_get_game_status",
        description:
          "Get the current Tic Tac Toe game status including board state, whose turn it is, and available moves. Use this when the student asks for help.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ],
    permissions: ["chat_context_read"],
    auth: "none",
    reviewStatus: "approved",
    icon: "❌",
  });

  registerApp({
    appId: "ludo",
    name: "Ludo",
    version: "1.0.0",
    description: "Classic Ludo board game for learning probability and decision-making",
    ui: {
      entrypointUrl: "/apps/ludo",
      sandboxProfile: "allow-scripts allow-same-origin",
    },
    tools: [
      {
        name: "ludo_start_game",
        description: "Start a new Ludo game",
        parameters: {
          type: "object",
          properties: {
            color: {
              type: "string",
              enum: ["red", "blue", "green", "yellow"],
              description: "The color the student plays as. Default red.",
            },
          },
          required: [],
        },
      },
      {
        name: "ludo_roll_dice",
        description: "Roll the dice in the current Ludo game",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "ludo_move_piece",
        description: "Move a specific piece after rolling the dice",
        parameters: {
          type: "object",
          properties: {
            pieceIndex: {
              type: "number",
              description: "Which piece to move (0-3)",
            },
          },
          required: ["pieceIndex"],
        },
      },
      {
        name: "ludo_get_game_status",
        description:
          "Get the current Ludo game status including piece positions, dice value, and whose turn it is. Use this when the student asks for help.",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ],
    permissions: ["chat_context_read"],
    auth: "none",
    reviewStatus: "approved",
    icon: "🎲",
  });

  registerApp({
    appId: "weather",
    name: "Weather Dashboard",
    version: "1.0.0",
    description: "Check current weather and forecasts for any location",
    ui: {
      entrypointUrl: "/apps/weather",
      sandboxProfile: "allow-scripts allow-same-origin",
    },
    tools: [
      {
        name: "weather_get_current",
        description: "Get current weather for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City name or coordinates",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "weather_get_forecast",
        description: "Get weather forecast for a location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "City name or coordinates",
            },
            days: {
              type: "number",
              description: "Number of forecast days (1-7)",
            },
          },
          required: ["location"],
        },
      },
    ],
    permissions: [],
    auth: "api_key",
    reviewStatus: "approved",
    icon: "🌤",
  });

  registerApp({
    appId: "spotify",
    name: "Spotify Playlist Creator",
    version: "1.0.0",
    description: "Search music, create playlists, and control playback",
    ui: {
      entrypointUrl: "/apps/spotify",
      sandboxProfile: "allow-scripts allow-same-origin",
    },
    tools: [
      {
        name: "spotify_search",
        description: "Search for songs, artists, or albums on Spotify",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            type: {
              type: "string",
              enum: ["track", "artist", "album"],
              description: "Type of search",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "spotify_create_playlist",
        description: "Create a new Spotify playlist",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Playlist name" },
            trackIds: {
              type: "array",
              items: { type: "string" },
              description: "Spotify track IDs to add",
            },
          },
          required: ["name"],
        },
      },
    ],
    permissions: ["user_auth"],
    auth: "oauth2",
    reviewStatus: "approved",
    icon: "🎵",
  });
}
