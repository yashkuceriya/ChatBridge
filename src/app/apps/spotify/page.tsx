"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Music, Search, Plus, ExternalLink, Check, ListMusic, X } from "lucide-react";
import { ChatBridgeSDK } from "@/lib/app-sdk";

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt?: string;
  previewUrl?: string;
}

export default function SpotifyApp() {
  const sdkRef = useRef<ChatBridgeSDK | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [isEmbedded] = useState(() => typeof window !== "undefined" && window.parent !== window);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [playlistCreated, setPlaylistCreated] = useState(false);

  // Ref-based tool handlers
  const searchTracksRef = useRef<((query: string) => void) | null>(null);
  const createPlaylistRef = useRef<((name: string, trackIds?: string[]) => void) | null>(null);

  // --- PostMessage lifecycle ---
  useEffect(() => {
    const sdk = new ChatBridgeSDK({ version: "1.0.0" });
    sdkRef.current = sdk;

    // Step 1: APP_READY
    sdk.ready(["spotify"]);
    console.log("[Spotify] APP_READY sent");

    // Step 2: SESSION_INIT
    const unsubSession = sdk.onSessionInit((sessionId, token, config) => {
      console.log("[Spotify] SESSION_INIT received", { sessionId });
      setSessionActive(true);
      // If auth token is provided via config, consider authenticated
      if (config.accessToken) {
        setIsAuthenticated(true);
      }
      checkAuth();
    });

    // Step 3: TOOL_INVOKE
    const unsubTool = sdk.onToolInvoke((toolName, args) => {
      console.log("[Spotify] TOOL_INVOKE received", { toolName, args });

      switch (toolName) {
        case "spotify_search":
          if (args.query) {
            searchTracksRef.current?.(args.query as string);
          }
          break;
        case "spotify_create_playlist":
          if (args.name) {
            createPlaylistRef.current?.(args.name as string, args.trackIds as string[] | undefined);
          }
          break;
      }
    });

    return () => {
      unsubSession();
      unsubTool();
    };
  }, []);

  const checkAuth = () => {
    // In production: check for valid OAuth token via platform proxy
    // For development, simulate as not authenticated initially
    setIsAuthenticated(false);
  };

  const handleLogin = () => {
    // OAuth flow happens via platform popup, not in iframe
    sdkRef.current?.updateState({ needsAuth: true, provider: "spotify" });
    // For demo purposes, simulate login after a short delay
    setTimeout(() => setIsAuthenticated(true), 500);
  };

  // --- Search tracks ---

  const searchTracks = useCallback((query: string) => {
    setLoading(true);
    setSearchQuery(query);
    setPlaylistCreated(false);

    // Mock search results for development
    const mockLibrary: Track[] = [
      { id: "1", name: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera" },
      { id: "2", name: "Hotel California", artist: "Eagles", album: "Hotel California" },
      { id: "3", name: "Stairway to Heaven", artist: "Led Zeppelin", album: "Led Zeppelin IV" },
      { id: "4", name: "Imagine", artist: "John Lennon", album: "Imagine" },
      { id: "5", name: "Smells Like Teen Spirit", artist: "Nirvana", album: "Nevermind" },
      { id: "6", name: "Yesterday", artist: "The Beatles", album: "Help!" },
      { id: "7", name: "Lose Yourself", artist: "Eminem", album: "8 Mile" },
      { id: "8", name: "Shape of You", artist: "Ed Sheeran", album: "Divide" },
      { id: "9", name: "Blinding Lights", artist: "The Weeknd", album: "After Hours" },
      { id: "10", name: "Bad Guy", artist: "Billie Eilish", album: "When We All Fall Asleep" },
    ];

    const results = mockLibrary.filter(
      (t) =>
        t.name.toLowerCase().includes(query.toLowerCase()) ||
        t.artist.toLowerCase().includes(query.toLowerCase()) ||
        t.album.toLowerCase().includes(query.toLowerCase())
    );

    const finalResults = results.length > 0 ? results : [
      { id: "search-1", name: `Result for "${query}"`, artist: "Artist", album: "Album" },
      { id: "search-2", name: `Another match for "${query}"`, artist: "Artist 2", album: "Album 2" },
    ];

    setTimeout(() => {
      setTracks(finalResults);
      setLoading(false);

      sdkRef.current?.updateState({
        searchQuery: query,
        resultCount: finalResults.length,
        tracks: finalResults.map(t => ({ id: t.id, name: t.name, artist: t.artist })),
      });
    }, 300);
  }, []);

  // --- Create playlist ---

  const createPlaylist = useCallback((name: string, trackIds?: string[]) => {
    const playlistTracks = trackIds
      ? tracks.filter((t) => trackIds.includes(t.id))
      : playlist.length > 0
        ? playlist
        : tracks; // If no playlist built, use all search results

    setPlaylistName(name);
    setPlaylist(playlistTracks);
    setPlaylistCreated(true);

    sdkRef.current?.complete({
      playlistName: name,
      trackCount: playlistTracks.length,
      tracks: playlistTracks.map((t) => ({ id: t.id, name: t.name, artist: t.artist })),
    });
    console.log("[Spotify] APP_COMPLETE sent — playlist created");
  }, [tracks, playlist]);

  // Keep refs updated
  searchTracksRef.current = searchTracks;
  createPlaylistRef.current = createPlaylist;

  // --- UI: Add to playlist ---

  const addToPlaylist = (track: Track) => {
    if (!playlist.find((t) => t.id === track.id)) {
      const newPlaylist = [...playlist, track];
      setPlaylist(newPlaylist);
      sdkRef.current?.updateState({
        playlistDraft: newPlaylist.map(t => ({ id: t.id, name: t.name, artist: t.artist })),
        trackCount: newPlaylist.length,
      });
    }
  };

  const removeFromPlaylist = (trackId: string) => {
    const newPlaylist = playlist.filter(t => t.id !== trackId);
    setPlaylist(newPlaylist);
    sdkRef.current?.updateState({
      playlistDraft: newPlaylist.map(t => ({ id: t.id, name: t.name, artist: t.artist })),
      trackCount: newPlaylist.length,
    });
  };

  // --- Not authenticated ---
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6">
        <Music className="mb-4 h-16 w-16 text-green-500" />
        <h2 className="mb-2 text-xl font-bold text-zinc-100">Connect Spotify</h2>
        <p className="mb-6 text-center text-sm text-zinc-400">
          Sign in with your Spotify account to search music and create playlists.
        </p>
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 rounded-full bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-500"
        >
          <ExternalLink className="h-4 w-4" />
          Connect with Spotify
        </button>
        {isEmbedded && (
          <p className="mt-4 text-xs text-zinc-600">Running inside ChatBridge</p>
        )}
      </div>
    );
  }

  // --- Playlist created success ---
  if (playlistCreated && playlistName) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-zinc-100">Spotify</h2>
          <button
            onClick={() => {
              setPlaylistCreated(false);
              setPlaylistName(null);
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Back to search
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-600/20">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h3 className="mb-1 text-lg font-bold text-zinc-100">Playlist Created!</h3>
          <p className="mb-1 text-sm text-zinc-400">{playlistName}</p>
          <p className="mb-6 text-xs text-zinc-500">{playlist.length} tracks</p>

          <div className="w-full max-w-sm space-y-1">
            {playlist.map((track, i) => (
              <div key={track.id} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 bg-zinc-900">
                <span className="w-5 text-right text-xs text-zinc-600">{i + 1}</span>
                <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800">
                  <Music className="h-3 w-3 text-zinc-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">{track.name}</p>
                  <p className="text-[10px] text-zinc-500 truncate">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Main search / playlist builder ---
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-zinc-100">Spotify</h2>
        {isEmbedded && (
          <span className="rounded-full bg-violet-900/50 px-2 py-0.5 text-[10px] text-violet-400">Embedded</span>
        )}
      </div>

      {/* Manual search (for standalone mode) */}
      {!isEmbedded && (
        <div className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchQuery.trim() && searchTracks(searchQuery.trim())}
              placeholder="Search for music..."
              className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
            <button
              onClick={() => searchQuery.trim() && searchTracks(searchQuery.trim())}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search Results */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
        </div>
      )}

      {tracks.length > 0 && !loading && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-medium text-zinc-400">
            Search Results {searchQuery && <span className="text-zinc-600">for &quot;{searchQuery}&quot;</span>}
          </h3>
          <div className="space-y-2">
            {tracks.map((track) => {
              const isInPlaylist = playlist.some(t => t.id === track.id);
              return (
                <div
                  key={track.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-900 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 flex-shrink-0">
                      <Music className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{track.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{track.artist} - {track.album}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => isInPlaylist ? removeFromPlaylist(track.id) : addToPlaylist(track)}
                    className={`rounded-full p-2 flex-shrink-0 ${
                      isInPlaylist
                        ? "text-green-400 hover:bg-zinc-800 hover:text-red-400"
                        : "text-zinc-500 hover:bg-zinc-800 hover:text-green-400"
                    }`}
                  >
                    {isInPlaylist ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Playlist draft */}
      {playlist.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-zinc-400">
              <ListMusic className="inline h-4 w-4 mr-1" />
              Playlist ({playlist.length} tracks)
            </h3>
            {!isEmbedded && (
              <button
                onClick={() => createPlaylist("My Playlist", playlist.map(t => t.id))}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
              >
                Create Playlist
              </button>
            )}
          </div>
          <div className="space-y-1">
            {playlist.map((track, i) => (
              <div
                key={track.id}
                className="flex items-center gap-3 rounded-lg bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300"
              >
                <span className="w-5 text-right text-xs text-zinc-600">{i + 1}</span>
                <span className="flex-1 truncate">{track.name}</span>
                <span className="text-zinc-600">-</span>
                <span className="text-zinc-500 truncate">{track.artist}</span>
                <button
                  onClick={() => removeFromPlaylist(track.id)}
                  className="rounded-full p-1 text-zinc-600 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && tracks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Search className="mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {isEmbedded
              ? "Ask ChatBridge to search for music!"
              : "Search for music to get started"
            }
          </p>
        </div>
      )}
    </div>
  );
}
