"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Music,
  Plus,
  Play,
  Pause,
  X,
  ListMusic,
  LogIn,
  Search,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Heart,
  Clock,
  GripVertical,
  Check,
} from "lucide-react";

interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  previewUrl?: string | null;
  externalUrl?: string | null;
  imageUrl?: string | null;
  duration?: string;
  genre?: string;
}

interface SpotifyPanelProps {
  sessionId: string;
  args: { query?: string; type?: string } & Record<string, unknown>;
  onStateUpdate: (state: Record<string, unknown>) => void;
  onComplete: (result: Record<string, unknown>) => void;
  onClose: () => void;
}

// Generate a deterministic color gradient from a string
function hashStringToGradient(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40 + Math.abs((hash >> 8) % 40)) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 60%, 35%), hsl(${hue2}, 50%, 25%))`;
}

// Generate mock duration
function mockDuration(id: string): string {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const mins = 2 + (hash % 4);
  const secs = 10 + (hash % 50);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Genre/mood tags
const GENRE_MAP: Record<string, string> = {
  "Bohemian Rhapsody": "Rock",
  "Hotel California": "Classic Rock",
  "Stairway to Heaven": "Rock",
  "Imagine": "Pop",
  "Smells Like Teen Spirit": "Grunge",
  "Billie Jean": "Pop",
  "Like a Rolling Stone": "Folk Rock",
  "Hey Jude": "Pop Rock",
  "Purple Rain": "R&B",
  "Superstition": "Funk",
};

const MOOD_TAGS: string[] = ["Energetic", "Chill", "Melancholy", "Upbeat", "Dreamy", "Intense"];

function getGenre(trackName: string): string {
  return GENRE_MAP[trackName] || MOOD_TAGS[trackName.length % MOOD_TAGS.length];
}

const MOCK_TRACKS: Track[] = [
  { id: "1", name: "Bohemian Rhapsody", artist: "Queen", album: "A Night at the Opera", duration: "5:55", genre: "Rock" },
  { id: "2", name: "Hotel California", artist: "Eagles", album: "Hotel California", duration: "6:30", genre: "Classic Rock" },
  { id: "3", name: "Stairway to Heaven", artist: "Led Zeppelin", album: "Led Zeppelin IV", duration: "8:02", genre: "Rock" },
  { id: "4", name: "Imagine", artist: "John Lennon", album: "Imagine", duration: "3:07", genre: "Pop" },
  { id: "5", name: "Smells Like Teen Spirit", artist: "Nirvana", album: "Nevermind", duration: "5:01", genre: "Grunge" },
  { id: "6", name: "Billie Jean", artist: "Michael Jackson", album: "Thriller", duration: "4:54", genre: "Pop" },
  { id: "7", name: "Like a Rolling Stone", artist: "Bob Dylan", album: "Highway 61 Revisited", duration: "6:13", genre: "Folk Rock" },
  { id: "8", name: "Hey Jude", artist: "The Beatles", album: "Non-album single", duration: "7:11", genre: "Pop Rock" },
  { id: "9", name: "Purple Rain", artist: "Prince", album: "Purple Rain", duration: "8:41", genre: "R&B" },
  { id: "10", name: "Superstition", artist: "Stevie Wonder", album: "Talking Book", duration: "4:26", genre: "Funk" },
];

function isSpotifyAuthenticated(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.includes("spotify_authenticated=true");
}

// Spotify logo SVG
function SpotifyLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

// Album art placeholder with gradient
function AlbumArt({ track, size = "md" }: { track: Track; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-14 w-14" : size === "md" ? "h-11 w-11" : "h-9 w-9";
  const textSize = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-xs";
  const gradient = hashStringToGradient(track.name + track.artist);

  return (
    <div
      className={`${dims} rounded-md flex-shrink-0 flex items-center justify-center shadow-lg`}
      style={{ background: gradient }}
    >
      <span className={`${textSize} font-bold text-white/60 select-none`}>
        {track.name.charAt(0)}
      </span>
    </div>
  );
}

export function SpotifyPanel({
  sessionId,
  args,
  onStateUpdate,
  onComplete,
  onClose,
}: SpotifyPanelProps) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(isSpotifyAuthenticated);
  const [isMockData, setIsMockData] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set());
  const [showPlaylist, setShowPlaylist] = useState(false);
  const popupInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const query = activeSearch || (args.query as string) || "";
  const searchType = (args.type as string) || "track";

  // Now playing track
  const nowPlaying = useMemo(() => {
    if (!playingTrackId) return null;
    return [...tracks, ...playlist].find((t) => t.id === playingTrackId) ?? null;
  }, [playingTrackId, tracks, playlist]);

  const performSearch = useCallback(async (searchQuery?: string) => {
    const q = searchQuery ?? query;
    setLoading(true);
    try {
      const response = await fetch("/api/apps/spotify/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q || "top hits", type: searchType }),
      });

      if (response.ok) {
        const data = await response.json();
        const results: Track[] = (data.results ?? []).map((t: Track) => ({
          ...t,
          duration: t.duration || mockDuration(t.id),
          genre: t.genre || getGenre(t.name),
        }));
        setTracks(results);
        setIsMockData(data.mock === true);
        setAuthenticated(!data.auth_required);

        onStateUpdate({
          searchQuery: q,
          searchType,
          resultCount: results.length,
          authenticated: !data.auth_required,
          results: results.map((t) => ({
            id: t.id,
            name: t.name,
            artist: t.artist,
          })),
        });
      } else {
        fallbackToMock(q);
      }
    } catch {
      fallbackToMock(q);
    } finally {
      setLoading(false);
    }
  }, [query, searchType]);

  const fallbackToMock = useCallback((searchQuery?: string) => {
    const q = (searchQuery ?? query).toLowerCase();
    const results = q
      ? MOCK_TRACKS.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q) ||
            (t.genre && t.genre.toLowerCase().includes(q))
        )
      : MOCK_TRACKS;

    const finalResults =
      results.length > 0
        ? results
        : MOCK_TRACKS.slice(0, 5).map((t) => ({ ...t, id: `q-${t.id}` }));

    setTracks(finalResults);
    setIsMockData(true);

    onStateUpdate({
      searchQuery: q,
      searchType,
      resultCount: finalResults.length,
      authenticated: false,
      results: finalResults.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artist,
      })),
    });
  }, [query, searchType]);

  useEffect(() => {
    performSearch();
  }, []);

  useEffect(() => {
    return () => {
      if (popupInterval.current) clearInterval(popupInterval.current);
    };
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveSearch(searchInput.trim());
      performSearch(searchInput.trim());
    }
  }, [searchInput, performSearch]);

  const handleConnectSpotify = useCallback(() => {
    const width = 500;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      "/api/auth/spotify",
      "spotify-auth",
      `width=${width},height=${height},left=${left},top=${top},popup=yes`
    );

    if (popup) {
      popupInterval.current = setInterval(() => {
        if (popup.closed) {
          if (popupInterval.current) clearInterval(popupInterval.current);
          popupInterval.current = null;

          const nowAuthenticated = isSpotifyAuthenticated();
          setAuthenticated(nowAuthenticated);
          if (nowAuthenticated) {
            performSearch();
          }
        }
      }, 500);
    }
  }, [performSearch]);

  const addToPlaylist = useCallback((track: Track) => {
    setPlaylist((prev) => {
      if (prev.find((t) => t.id === track.id)) return prev;
      return [...prev, track];
    });
  }, []);

  const removeFromPlaylist = useCallback((trackId: string) => {
    setPlaylist((prev) => prev.filter((t) => t.id !== trackId));
  }, []);

  const togglePreview = useCallback((trackId: string) => {
    setPlayingTrackId((prev) => (prev === trackId ? null : trackId));
  }, []);

  const toggleLike = useCallback((trackId: string) => {
    setLikedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  const handleSavePlaylist = () => {
    onComplete({
      playlistName: query ? `${query} playlist` : "My Playlist",
      trackCount: playlist.length,
      tracks: playlist.map((t) => ({
        id: t.id,
        name: t.name,
        artist: t.artist,
        album: t.album,
      })),
    });
  };

  // Connect Spotify screen (unauthenticated, no results yet)
  if (!authenticated && !loading && tracks.length === 0) {
    return (
      <div className="flex flex-col h-full bg-gradient-to-b from-zinc-900 to-black">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <SpotifyLogo className="h-4 w-4 text-[#1DB954]" />
            <span className="text-sm font-semibold text-zinc-100">Spotify</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="p-5 rounded-full bg-[#1DB954]/10 mb-6">
            <SpotifyLogo className="h-16 w-16 text-[#1DB954]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Connect to Spotify</h2>
          <p className="text-sm text-zinc-400 text-center max-w-[260px] mb-8 leading-relaxed">
            Link your Spotify account to search tracks, build playlists, and control playback.
          </p>
          <button
            onClick={handleConnectSpotify}
            className="flex items-center gap-2.5 rounded-full bg-[#1DB954] px-8 py-3 text-sm font-bold text-black hover:bg-[#1ed760] hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[#1DB954]/20"
          >
            <LogIn className="h-4 w-4" />
            Connect Spotify
          </button>
          <p className="text-[11px] text-zinc-600 mt-10">Powered by Spotify</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-zinc-900/50 to-black relative">
      {/* Panel CSS */}
      <style>{`
        @keyframes eq1 { 0%, 100% { height: 4px; } 50% { height: 14px; } }
        @keyframes eq2 { 0%, 100% { height: 8px; } 50% { height: 4px; } }
        @keyframes eq3 { 0%, 100% { height: 6px; } 50% { height: 16px; } }
        @keyframes progressSlide { from { width: 0%; } to { width: 65%; } }
        .eq-bar-1 { animation: eq1 0.5s ease-in-out infinite; }
        .eq-bar-2 { animation: eq2 0.4s ease-in-out infinite 0.1s; }
        .eq-bar-3 { animation: eq3 0.45s ease-in-out infinite 0.2s; }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <SpotifyLogo className="h-4 w-4 text-[#1DB954]" />
          <span className="text-sm font-semibold text-zinc-100">Spotify</span>
          {isMockData && (
            <span className="rounded-full bg-zinc-800 border border-zinc-700/50 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
              Demo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPlaylist(!showPlaylist)}
            className={`relative rounded-md p-1.5 transition-colors ${
              showPlaylist
                ? "bg-[#1DB954]/10 text-[#1DB954]"
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            }`}
            title="Playlist"
          >
            <ListMusic className="h-4 w-4" />
            {playlist.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#1DB954] text-[8px] font-bold text-black flex items-center justify-center">
                {playlist.length}
              </span>
            )}
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search songs, artists, albums..."
            className="w-full rounded-lg bg-white/[0.07] border border-white/[0.06] pl-9 pr-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/10 focus:bg-white/[0.09] transition-colors"
          />
        </form>
      </div>

      {/* Auth banner */}
      {!authenticated && !loading && (
        <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-2 flex-shrink-0">
          <p className="text-xs text-zinc-500">
            Connect for real results
          </p>
          <button
            onClick={handleConnectSpotify}
            className="flex items-center gap-1.5 rounded-full bg-[#1DB954] px-3 py-1 text-[11px] font-bold text-black hover:bg-[#1ed760] transition-colors"
          >
            <LogIn className="h-3 w-3" />
            Connect
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-4">
              <SpotifyLogo className="h-8 w-8 text-[#1DB954] animate-pulse" />
            </div>
            <p className="text-sm text-zinc-500">
              Searching{query ? ` "${query}"` : ""}...
            </p>
          </div>
        )}

        {/* Playlist view */}
        {!loading && showPlaylist && (
          <div className="p-3">
            {playlist.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-base font-bold text-white">Your Playlist</h3>
                    <p className="text-[11px] text-zinc-500">
                      {playlist.length} track{playlist.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={handleSavePlaylist}
                    className="rounded-full bg-[#1DB954] px-5 py-2 text-xs font-bold text-black hover:bg-[#1ed760] hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Save Playlist
                  </button>
                </div>
                <div className="space-y-0.5">
                  {playlist.map((track, i) => (
                    <div
                      key={track.id}
                      className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="w-5 flex-shrink-0 flex items-center justify-center">
                        <GripVertical className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                      </div>
                      <span className="w-5 text-right text-xs text-zinc-600 flex-shrink-0 group-hover:hidden">
                        {i + 1}
                      </span>
                      <span className="w-5 text-right text-xs text-zinc-600 flex-shrink-0 hidden group-hover:block">
                        <Play className="h-3.5 w-3.5 text-white" />
                      </span>
                      <AlbumArt track={track} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{track.name}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{track.artist}</p>
                      </div>
                      <span className="text-[11px] text-zinc-600 flex-shrink-0 mr-2">
                        {track.duration || mockDuration(track.id)}
                      </span>
                      <button
                        onClick={() => removeFromPlaylist(track.id)}
                        className="opacity-0 group-hover:opacity-100 rounded-full p-1 text-zinc-600 hover:text-red-400 transition-all"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="p-4 rounded-full bg-white/[0.03] mb-4">
                  <ListMusic className="h-8 w-8 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500 font-medium">Your playlist is empty</p>
                <p className="text-xs text-zinc-600 mt-1">Add tracks from search results</p>
              </div>
            )}
          </div>
        )}

        {/* Search Results */}
        {!loading && !showPlaylist && tracks.length > 0 && (
          <div className="p-3">
            <div className="flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {query ? `Results for "${query}"` : "Top Tracks"} ({tracks.length})
              </h3>
            </div>

            {/* Track list header */}
            <div className="flex items-center gap-3 px-2 py-1.5 text-[11px] text-zinc-600 border-b border-white/5 mb-1">
              <span className="w-8 text-center">#</span>
              <span className="flex-1">Title</span>
              <span className="w-14 text-right">
                <Clock className="h-3 w-3 inline-block" />
              </span>
              <span className="w-16" />
            </div>

            <div className="space-y-0.5">
              {tracks.map((track, index) => {
                const inPlaylist = playlist.some((t) => t.id === track.id);
                const isPlaying = playingTrackId === track.id;
                const isHovered = hoveredTrackId === track.id;
                const isLiked = likedTracks.has(track.id);

                return (
                  <div
                    key={track.id}
                    className={`group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors cursor-default ${
                      isPlaying
                        ? "bg-white/[0.06]"
                        : "hover:bg-white/[0.04]"
                    }`}
                    onMouseEnter={() => setHoveredTrackId(track.id)}
                    onMouseLeave={() => setHoveredTrackId(null)}
                  >
                    {/* Track number / Play button */}
                    <div className="w-8 flex-shrink-0 flex items-center justify-center">
                      {isPlaying ? (
                        <button
                          onClick={() => togglePreview(track.id)}
                          className="flex items-center justify-center"
                        >
                          <div className="flex items-end gap-[2px] h-3.5">
                            <span className="block w-[3px] bg-[#1DB954] rounded-sm eq-bar-1" />
                            <span className="block w-[3px] bg-[#1DB954] rounded-sm eq-bar-2" />
                            <span className="block w-[3px] bg-[#1DB954] rounded-sm eq-bar-3" />
                          </div>
                        </button>
                      ) : isHovered ? (
                        <button
                          onClick={() => togglePreview(track.id)}
                          className="text-white hover:text-[#1DB954] transition-colors"
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-600">{index + 1}</span>
                      )}
                    </div>

                    {/* Album art */}
                    <AlbumArt track={track} size="md" />

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${
                        isPlaying ? "text-[#1DB954]" : "text-zinc-200"
                      }`}>
                        {track.name}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[11px] text-zinc-500 truncate">
                          {track.artist} &middot; {track.album}
                        </p>
                      </div>
                      {/* Genre tag */}
                      <span className="inline-block mt-0.5 rounded-full bg-white/[0.05] border border-white/[0.05] px-2 py-[1px] text-[9px] font-medium text-zinc-500">
                        {track.genre || getGenre(track.name)}
                      </span>
                    </div>

                    {/* Like button */}
                    <button
                      onClick={() => toggleLike(track.id)}
                      className={`flex-shrink-0 p-1 rounded-full transition-all ${
                        isLiked
                          ? "text-[#1DB954]"
                          : "text-transparent group-hover:text-zinc-600 hover:!text-white"
                      }`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-current" : ""}`} />
                    </button>

                    {/* Duration */}
                    <span className="w-10 text-right text-[11px] text-zinc-600 flex-shrink-0">
                      {track.duration || mockDuration(track.id)}
                    </span>

                    {/* Add to playlist */}
                    <button
                      onClick={() => addToPlaylist(track)}
                      disabled={inPlaylist}
                      className={`flex-shrink-0 rounded-full p-1.5 transition-all ${
                        inPlaylist
                          ? "text-[#1DB954]"
                          : "text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-[#1DB954] hover:bg-white/5"
                      }`}
                      title={inPlaylist ? "Added" : "Add to playlist"}
                    >
                      {inPlaylist ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !showPlaylist && tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 rounded-full bg-white/[0.03] mb-4">
              <Music className="h-8 w-8 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-400 font-medium">No results found</p>
            <p className="text-xs text-zinc-600 mt-1">Try a different search</p>
          </div>
        )}
      </div>

      {/* Now Playing bar */}
      {nowPlaying && (
        <div className="border-t border-white/5 bg-zinc-950/80 backdrop-blur-md flex-shrink-0">
          {/* Progress bar */}
          <div className="h-[3px] bg-white/5 relative">
            <div
              className="absolute inset-y-0 left-0 bg-[#1DB954] rounded-r-full"
              style={{ animation: "progressSlide 4s ease-out forwards" }}
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2.5">
            {/* Track info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <AlbumArt track={nowPlaying} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-white truncate">{nowPlaying.name}</p>
                <p className="text-[11px] text-zinc-500 truncate">{nowPlaying.artist}</p>
              </div>
              <button
                onClick={() => toggleLike(nowPlaying.id)}
                className={`flex-shrink-0 p-1 ${
                  likedTracks.has(nowPlaying.id)
                    ? "text-[#1DB954]"
                    : "text-zinc-600 hover:text-white"
                } transition-colors`}
              >
                <Heart className={`h-3 w-3 ${likedTracks.has(nowPlaying.id) ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
              <button className="p-1 text-zinc-500 hover:text-white transition-colors">
                <Shuffle className="h-3.5 w-3.5" />
              </button>
              <button className="p-1 text-zinc-500 hover:text-white transition-colors">
                <SkipBack className="h-3.5 w-3.5 fill-current" />
              </button>
              <button
                onClick={() => togglePreview(nowPlaying.id)}
                className="p-1.5 rounded-full bg-white text-black hover:scale-105 transition-transform"
              >
                <Pause className="h-3.5 w-3.5 fill-current" />
              </button>
              <button className="p-1 text-zinc-500 hover:text-white transition-colors">
                <SkipForward className="h-3.5 w-3.5 fill-current" />
              </button>
              <button className="p-1 text-zinc-500 hover:text-white transition-colors">
                <Repeat className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <Volume2 className="h-3.5 w-3.5 text-zinc-500" />
              <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full w-3/4 bg-white/40 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer branding */}
      <div className="flex items-center justify-center border-t border-white/[0.03] py-1.5 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <SpotifyLogo className="h-3 w-3 text-zinc-600" />
          <span className="text-[10px] text-zinc-600 font-medium">Powered by Spotify</span>
        </div>
      </div>
    </div>
  );
}
