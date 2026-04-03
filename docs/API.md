# ChatBridge Plugin API

## Overview

ChatBridge uses a **plugin model** that allows third-party applications to extend the capabilities of the AI chat assistant. Each plugin (called an "app") is a standalone web application loaded inside a sandboxed iframe. The platform orchestrates communication between the AI assistant and your app through a structured PostMessage protocol.

Apps register a **manifest** that declares their metadata, tools, permissions, and authentication requirements. When the AI determines it needs to use one of your tools, ChatBridge spins up an **app session**, loads your UI in an iframe, and relays tool calls through the PostMessage bridge. Your app can update shared state visible to the AI, signal completion, or report errors -- all without direct DOM access to the host page.

---

## App Manifest

Every app must provide a manifest conforming to the `AppManifest` interface. This is the JSON object you submit when registering your app.

### Schema

| Field            | Type                                          | Required | Description                                                                 |
| ---------------- | --------------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `appId`          | `string`                                      | Yes      | Unique identifier for your app (e.g., `"my-company.timer"`).               |
| `name`           | `string`                                      | Yes      | Human-readable display name.                                                |
| `version`        | `string`                                      | Yes      | Semver version string (e.g., `"1.0.0"`).                                   |
| `description`    | `string`                                      | Yes      | Short description shown in the app catalogue.                               |
| `ui`             | `object`                                      | Yes      | UI configuration (see below).                                               |
| `ui.entrypointUrl` | `string`                                    | Yes      | URL the iframe loads. Can be a relative path (hosted apps) or absolute URL. |
| `ui.sandboxProfile` | `string`                                   | Yes      | iframe sandbox flags (e.g., `"allow-scripts"`).                             |
| `tools`          | `ToolDefinition[]`                            | Yes      | Array of tools your app exposes to the AI (see next section).               |
| `permissions`    | `string[]`                                    | Yes      | Permissions your app requires (e.g., `["chat_context_read"]`).              |
| `auth`           | `"none"` \| `"api_key"` \| `"oauth2"`        | Yes      | Authentication model your app uses.                                         |
| `reviewStatus`   | `"unreviewed"` \| `"reviewed"` \| `"approved"` | Yes    | Review status. Only `"approved"` apps are discoverable by users.            |
| `icon`           | `string`                                      | No       | Emoji or icon URL displayed alongside your app name.                        |

### Example

```json
{
  "appId": "acme.weather",
  "name": "Weather Dashboard",
  "version": "1.0.0",
  "description": "Check current weather and forecasts for any location",
  "ui": {
    "entrypointUrl": "/apps/weather",
    "sandboxProfile": "allow-scripts"
  },
  "tools": [
    {
      "name": "weather_get_current",
      "description": "Get current weather for a location",
      "parameters": {
        "type": "object",
        "properties": {
          "location": {
            "type": "string",
            "description": "City name or coordinates"
          }
        },
        "required": ["location"]
      }
    }
  ],
  "permissions": [],
  "auth": "api_key",
  "reviewStatus": "unreviewed",
  "icon": "weather-icon.png"
}
```

---

## Tool Definitions

Tools are the bridge between the AI assistant and your app. When the AI decides to use a tool, ChatBridge sends a `TOOL_INVOKE` message to your iframe with the tool name and arguments.

### Schema

| Field         | Type                       | Required | Description                                                        |
| ------------- | -------------------------- | -------- | ------------------------------------------------------------------ |
| `name`        | `string`                   | Yes      | Unique tool name. Use the pattern `appname_action` (e.g., `chess_start_game`). |
| `description` | `string`                   | Yes      | Natural-language description the AI uses to decide when to call this tool. |
| `parameters`  | `Record<string, unknown>`  | Yes      | A JSON Schema object describing the tool's input parameters.       |
| `returns`     | `Record<string, unknown>`  | No       | A JSON Schema object describing the tool's return value.           |

### Parameter JSON Schema

Parameters must be a valid JSON Schema `object`. The AI uses the property descriptions to understand what values to pass.

### Example: A Simple Timer Tool

```json
{
  "name": "timer_start",
  "description": "Start a countdown timer for a given number of seconds",
  "parameters": {
    "type": "object",
    "properties": {
      "seconds": {
        "type": "number",
        "description": "Duration in seconds"
      },
      "label": {
        "type": "string",
        "description": "Optional label for the timer"
      }
    },
    "required": ["seconds"]
  },
  "returns": {
    "type": "object",
    "properties": {
      "timerId": { "type": "string" }
    }
  }
}
```

---

## PostMessage Protocol

All communication between your app (running in an iframe) and the ChatBridge platform (the host page) happens through `window.postMessage`. Messages are JSON objects with a `type` discriminator and a `payload` object.

All messages are validated server-side using Zod schemas. Malformed messages are silently dropped.

---

### App -> Platform Messages

These are messages your app sends to the platform via `window.parent.postMessage(message, "*")`.

#### `APP_READY`

Sent once when your app has finished loading and is ready to receive messages.

**Payload Schema**

| Field          | Type       | Description                                             |
| -------------- | ---------- | ------------------------------------------------------- |
| `version`      | `string`   | Your app's version string (should match the manifest).  |
| `capabilities` | `string[]` | List of capabilities your app supports.                 |

**Example**

```json
{
  "type": "APP_READY",
  "payload": {
    "version": "1.0.0",
    "capabilities": ["interactive-ui", "state-sync"]
  }
}
```

---

#### `APP_STATE_UPDATE`

Sent whenever your app's state changes and the AI should be aware of the new state. This updates the shared context visible to the chatbot.

**Payload Schema**

| Field          | Type                       | Description                                    |
| -------------- | -------------------------- | ---------------------------------------------- |
| `appSessionId` | `string`                  | The session ID received during `SESSION_INIT`.  |
| `state`        | `Record<string, unknown>` | Arbitrary key-value pairs representing app state. |

**Example**

```json
{
  "type": "APP_STATE_UPDATE",
  "payload": {
    "appSessionId": "sess_abc123",
    "state": {
      "currentTemperature": 72,
      "unit": "fahrenheit",
      "location": "San Francisco"
    }
  }
}
```

---

#### `APP_COMPLETE`

Sent when your app has finished its task. The platform will transition the session to `"completed"` status.

**Payload Schema**

| Field          | Type                       | Description                          |
| -------------- | -------------------------- | ------------------------------------ |
| `appSessionId` | `string`                  | The session ID from `SESSION_INIT`.   |
| `result`       | `Record<string, unknown>` | Final result data from the app.       |

**Example**

```json
{
  "type": "APP_COMPLETE",
  "payload": {
    "appSessionId": "sess_abc123",
    "result": {
      "winner": "white",
      "totalMoves": 24,
      "finalPosition": "rnbqkbnr/pppppppp/..."
    }
  }
}
```

---

#### `APP_ERROR`

Sent when your app encounters an error it cannot recover from.

**Payload Schema**

| Field          | Type     | Description                                    |
| -------------- | -------- | ---------------------------------------------- |
| `appSessionId` | `string` | The session ID from `SESSION_INIT` (or `null` if not yet initialized). |
| `error`        | `string` | Human-readable error message.                   |
| `code`         | `string` | Machine-readable error code (e.g., `"NETWORK_FAILURE"`, `"INVALID_ARGS"`). |

**Example**

```json
{
  "type": "APP_ERROR",
  "payload": {
    "appSessionId": "sess_abc123",
    "error": "Failed to fetch weather data from upstream API",
    "code": "UPSTREAM_TIMEOUT"
  }
}
```

---

### Platform -> App Messages

These are messages the ChatBridge platform sends to your app's iframe. Listen for them with `window.addEventListener("message", handler)`.

#### `SESSION_INIT`

Sent after the platform creates an app session and loads your iframe. This is the first message you will receive after sending `APP_READY`.

**Payload Schema**

| Field             | Type                       | Description                                                    |
| ----------------- | -------------------------- | -------------------------------------------------------------- |
| `appSessionId`    | `string`                  | Unique session identifier. Store this -- you need it for all outbound messages. |
| `capabilityToken` | `string`                  | Short-lived token authorizing your app to call platform APIs.   |
| `config`          | `Record<string, unknown>` | Session-specific configuration (e.g., user preferences, teacher restrictions). |

**Example**

```json
{
  "type": "SESSION_INIT",
  "payload": {
    "appSessionId": "sess_abc123",
    "capabilityToken": "cap_tok_xyz789",
    "config": {
      "theme": "dark",
      "locale": "en-US"
    }
  }
}
```

---

#### `TOOL_INVOKE`

Sent when the AI assistant calls one of your registered tools. Your app should execute the requested action and respond by updating state or completing.

**Payload Schema**

| Field             | Type                       | Description                                     |
| ----------------- | -------------------------- | ----------------------------------------------- |
| `toolName`        | `string`                  | Name of the tool being invoked (matches your manifest). |
| `args`            | `Record<string, unknown>` | Arguments matching the tool's JSON Schema parameters.   |
| `capabilityToken` | `string`                  | Refreshed capability token for this invocation.          |

**Example**

```json
{
  "type": "TOOL_INVOKE",
  "payload": {
    "toolName": "weather_get_current",
    "args": {
      "location": "San Francisco"
    },
    "capabilityToken": "cap_tok_xyz789"
  }
}
```

---

#### `SESSION_END`

Sent when the platform is ending the app session. Clean up any resources when you receive this.

**Payload Schema**

| Field    | Type     | Description                                                           |
| -------- | -------- | --------------------------------------------------------------------- |
| `reason` | `string` | Why the session is ending (e.g., `"user_navigated"`, `"timeout"`, `"conversation_ended"`). |

**Example**

```json
{
  "type": "SESSION_END",
  "payload": {
    "reason": "conversation_ended"
  }
}
```

---

## ChatBridge App SDK

The `ChatBridgeSDK` class wraps the PostMessage protocol so you do not have to manage raw message passing yourself. It handles session tracking, capability tokens, and message routing automatically.

### Installation

```bash
npm install @chatbridge/sdk
```

### Quick Start

```js
import { ChatBridgeSDK } from '@chatbridge/sdk';

const sdk = new ChatBridgeSDK({ version: '1.0.0' });

// 1. Signal that the app is ready
sdk.ready(['interactive-ui']);

// 2. Listen for session initialization
sdk.onSessionInit((sessionId, token, config) => {
  console.log('Session started:', sessionId);
  console.log('Config:', config);
});

// 3. Handle tool invocations from the AI
sdk.onToolInvoke((toolName, args) => {
  if (toolName === 'weather_get_current') {
    fetchWeather(args.location).then((data) => {
      sdk.updateState({ temperature: data.temp, conditions: data.conditions });
    });
  }
});

// 4. When the task is done, signal completion
function onUserFinished(result) {
  sdk.complete({ summary: result });
}
```

### API Reference

#### `new ChatBridgeSDK(options?)`

Creates a new SDK instance and starts listening for platform messages.

| Option    | Type     | Default   | Description              |
| --------- | -------- | --------- | ------------------------ |
| `version` | `string` | `"1.0.0"` | Your app's version string. |

#### `sdk.ready(capabilities?: string[]): void`

Sends `APP_READY` to the platform. Call this once after your app has finished loading. Optionally pass a list of capability strings.

#### `sdk.updateState(state: Record<string, unknown>): void`

Sends `APP_STATE_UPDATE` with the given state object. The state is merged into the shared context visible to the AI assistant. Requires an active session (logs a warning if called before `SESSION_INIT`).

#### `sdk.complete(result: Record<string, unknown>): void`

Sends `APP_COMPLETE` to signal that the app's task is finished. The session transitions to `"completed"` status. Requires an active session.

#### `sdk.error(errorMessage: string, code?: string): void`

Sends `APP_ERROR` to report an unrecoverable error. The `code` parameter defaults to `"APP_ERROR"` if not provided.

#### `sdk.onToolInvoke(handler: (toolName, args) => void): () => void`

Registers a callback that fires whenever the platform sends a `TOOL_INVOKE` message. Returns an unsubscribe function.

#### `sdk.onSessionInit(handler: (sessionId, token, config) => void): () => void`

Registers a callback that fires when the platform sends `SESSION_INIT`. The SDK automatically stores the `sessionId` and `capabilityToken` internally. Returns an unsubscribe function.

#### `sdk.getSessionId(): string | null`

Returns the current session ID, or `null` if no session is active.

---

## App Lifecycle

The full lifecycle of a ChatBridge app follows these steps:

```
Registration -> Discovery -> Invocation -> Render -> Interaction -> Completion
```

### 1. Registration

You submit your `AppManifest` to the ChatBridge plugin registry. Your app starts with `reviewStatus: "unreviewed"` and is not visible to users until it is approved.

### 2. Discovery

When a user starts a conversation, the platform loads all approved apps whose tools are available for the current context. The AI assistant receives the tool definitions as part of its system prompt.

### 3. Invocation

The AI decides to call one of your tools based on the user's request. The platform:

1. Creates an `AppSession` with status `"initializing"`.
2. Loads your `ui.entrypointUrl` in a sandboxed iframe.
3. Waits for your app to send `APP_READY`.

### 4. Render

After receiving `APP_READY`, the platform sends `SESSION_INIT` with the session ID, capability token, and any configuration. Your iframe is displayed in the chat interface. The session transitions to `"active"`.

### 5. Interaction

The platform sends `TOOL_INVOKE` messages as the AI calls your tools. Your app:

- Executes the requested action.
- Sends `APP_STATE_UPDATE` messages to keep the AI informed of changes.
- Renders interactive UI that the user can engage with directly.

A session may be `"backgrounded"` if the user scrolls away and reactivated later.

### 6. Completion

When the task is done, your app sends `APP_COMPLETE` with a result object. The platform transitions the session to `"completed"` and the AI can summarize the result to the user. If something goes wrong, send `APP_ERROR` instead. Sessions may also be ended by the platform via `SESSION_END` (e.g., on timeout or navigation).

Possible session statuses: `"initializing"` | `"active"` | `"backgrounded"` | `"completed"` | `"error"` | `"timed_out"`.

---

## Authentication Types

ChatBridge supports three authentication models, declared in your manifest's `auth` field.

### Internal (`"none"`)

No authentication required. Suitable for apps that are fully self-contained and do not access external services or user data.

```json
{ "auth": "none" }
```

**Use case:** A chess game, a calculator, a drawing tool.

### External Public (`"api_key"`)

Your app uses an API key to access a third-party service. The API key is configured by the platform administrator and injected into your session config -- it is never exposed to the end user.

```json
{ "auth": "api_key" }
```

**Use case:** A weather app using an API key for a weather service, a translation tool using a paid API.

### External Authenticated (`"oauth2"`)

Your app requires per-user authentication with a third-party service via OAuth 2.0. ChatBridge manages the OAuth flow, stores tokens securely (`OAuthToken`), and provides the access token in the session's capability token or config.

```json
{ "auth": "oauth2" }
```

**Use case:** A Spotify playlist manager, a Google Calendar integration, a GitHub issue tracker.

When using OAuth2, ChatBridge stores the following token data per user:

| Field          | Type     | Description                        |
| -------------- | -------- | ---------------------------------- |
| `accessToken`  | `string` | The current OAuth access token.    |
| `refreshToken` | `string` | Optional refresh token.            |
| `expiresAt`    | `Date`   | Token expiration timestamp.        |
| `scope`        | `string` | OAuth scopes granted by the user.  |

---

## Security Requirements

### Sandbox Flags

All app iframes are loaded with the HTML `sandbox` attribute. You declare which sandbox relaxations your app needs in `ui.sandboxProfile`.

| Flag                  | When to Use                                         |
| --------------------- | --------------------------------------------------- |
| `allow-scripts`       | **Required for all apps.** Enables JavaScript execution. |
| `allow-same-origin`   | Only if your app needs to access cookies or localStorage on the same origin. Use sparingly. |

**Principle of least privilege:** request only the sandbox flags you genuinely need. Apps requesting `allow-same-origin` undergo stricter review.

```json
{
  "ui": {
    "entrypointUrl": "/apps/my-app",
    "sandboxProfile": "allow-scripts"
  }
}
```

### Origin Requirements

- Apps must validate the origin of incoming `message` events before processing them. Only trust messages from the ChatBridge host origin.
- The platform validates all messages from app iframes against strict Zod schemas. Messages that fail validation are dropped.
- Capability tokens are short-lived and scoped to a single session. Do not cache them beyond the current session.

### Data Handling Rules

- **Do not store user data outside the session.** Your app receives data through `SESSION_INIT` config and `TOOL_INVOKE` args. Do not persist this data to external servers without explicit user consent and appropriate `permissions` declarations.
- **Treat capability tokens as secrets.** Never log them, include them in error reports, or send them to third-party services.
- **Minimize state exposure.** Only include data in `APP_STATE_UPDATE` that the AI genuinely needs. Avoid sending sensitive information (passwords, tokens, PII) through state updates.
- **All audit events are logged.** The platform records every PostMessage exchange, tool invocation, and session lifecycle event in the audit log. Build your app with the assumption that all actions are observable.

---

## Example: Building a Simple Counter App

Below is a complete, minimal example of a ChatBridge app: an interactive counter that the AI can increment, decrement, and reset.

### 1. App Manifest

```json
{
  "appId": "example.counter",
  "name": "Counter",
  "version": "1.0.0",
  "description": "A simple counter that can be incremented, decremented, or reset",
  "ui": {
    "entrypointUrl": "/apps/counter",
    "sandboxProfile": "allow-scripts"
  },
  "tools": [
    {
      "name": "counter_increment",
      "description": "Increment the counter by a given amount",
      "parameters": {
        "type": "object",
        "properties": {
          "amount": {
            "type": "number",
            "description": "Amount to increment by (default 1)"
          }
        }
      }
    },
    {
      "name": "counter_decrement",
      "description": "Decrement the counter by a given amount",
      "parameters": {
        "type": "object",
        "properties": {
          "amount": {
            "type": "number",
            "description": "Amount to decrement by (default 1)"
          }
        }
      }
    },
    {
      "name": "counter_reset",
      "description": "Reset the counter to zero",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  ],
  "permissions": [],
  "auth": "none",
  "reviewStatus": "unreviewed"
}
```

### 2. App Code (`counter.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: #f5f5f5;
    }
    #count {
      font-size: 4rem;
      font-weight: bold;
      margin: 1rem 0;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
    }
    button {
      padding: 0.5rem 1.5rem;
      font-size: 1.2rem;
      border: none;
      border-radius: 6px;
      background: #0066cc;
      color: white;
      cursor: pointer;
    }
    button:hover {
      background: #0052a3;
    }
  </style>
</head>
<body>
  <h2>Counter App</h2>
  <div id="count">0</div>
  <div class="controls">
    <button onclick="adjust(-1)">-</button>
    <button onclick="resetCounter()">Reset</button>
    <button onclick="adjust(1)">+</button>
  </div>

  <script type="module">
    import { ChatBridgeSDK } from '@chatbridge/sdk';

    const sdk = new ChatBridgeSDK({ version: '1.0.0' });
    let count = 0;

    function render() {
      document.getElementById('count').textContent = count;
      sdk.updateState({ count });
    }

    // Handle tool calls from the AI
    sdk.onToolInvoke((toolName, args) => {
      switch (toolName) {
        case 'counter_increment':
          count += args.amount ?? 1;
          break;
        case 'counter_decrement':
          count -= args.amount ?? 1;
          break;
        case 'counter_reset':
          count = 0;
          break;
      }
      render();
    });

    // Handle direct user interaction
    window.adjust = function (delta) {
      count += delta;
      render();
    };

    window.resetCounter = function () {
      count = 0;
      render();
    };

    // Signal ready
    sdk.ready(['interactive-ui']);
  </script>
</body>
</html>
```

### 3. What Happens at Runtime

1. A user asks the AI: "Can you start a counter and increment it to 5?"
2. The AI calls `counter_increment` with `{ "amount": 5 }`.
3. ChatBridge creates a session, loads the counter iframe, and waits for `APP_READY`.
4. The SDK sends `APP_READY`, receives `SESSION_INIT`, then receives `TOOL_INVOKE`.
5. The tool handler increments the count and calls `sdk.updateState({ count: 5 })`.
6. The AI sees the updated state and can report back: "The counter is now at 5."
7. The user can also click the buttons in the iframe to adjust the count directly.
