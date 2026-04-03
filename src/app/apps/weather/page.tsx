"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Cloud, Sun, CloudRain, Thermometer, Wind, Droplets, CloudSnow, CloudLightning } from "lucide-react";
import { ChatBridgeSDK } from "@/lib/app-sdk";

interface WeatherData {
  location: string;
  temp: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  feelsLike?: number;
  high?: number;
  low?: number;
}

interface ForecastDay {
  day: string;
  high: number;
  low: number;
  description: string;
  icon: string;
}

export default function WeatherApp() {
  const sdkRef = useRef<ChatBridgeSDK | null>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [isEmbedded, setIsEmbedded] = useState(false);
  useEffect(() => { setIsEmbedded(window.parent !== window); }, []);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref-based tool handler to access latest state
  const fetchWeatherRef = useRef<((location: string) => Promise<void>) | null>(null);
  const fetchForecastRef = useRef<((location: string) => Promise<void>) | null>(null);

  // --- PostMessage lifecycle ---
  useEffect(() => {
    const sdk = new ChatBridgeSDK({ version: "1.0.0" });
    sdkRef.current = sdk;

    // Step 1: APP_READY
    sdk.ready(["weather"]);
    console.log("[Weather] APP_READY sent");

    // Step 2: SESSION_INIT
    const unsubSession = sdk.onSessionInit((sessionId, token, config) => {
      console.log("[Weather] SESSION_INIT received", { sessionId });
      setSessionActive(true);
      // If config has an initial location, fetch it
      if (config.location) {
        fetchWeatherRef.current?.(config.location as string);
      }
    });

    // Step 3: TOOL_INVOKE
    const unsubTool = sdk.onToolInvoke((toolName, args) => {
      console.log("[Weather] TOOL_INVOKE received", { toolName, args });

      switch (toolName) {
        case "weather_get_current":
          if (args.location) {
            fetchWeatherRef.current?.(args.location as string);
          }
          break;
        case "weather_get_forecast":
          if (args.location) {
            fetchForecastRef.current?.(args.location as string);
          }
          break;
      }
    });

    return () => {
      unsubSession();
      unsubTool();
    };
  }, []);

  // --- Weather fetching ---

  const fetchWeather = useCallback(async (location: string) => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
      if (!apiKey) {
        // Use mock data in dev
        const mockData: WeatherData = {
          location,
          temp: 72,
          description: "Partly Cloudy",
          humidity: 45,
          windSpeed: 8,
          icon: "cloud",
          feelsLike: 70,
          high: 78,
          low: 64,
        };
        setWeather(mockData);
        sdkRef.current?.updateState({ ...mockData, type: "current" });

        // Signal complete
        sdkRef.current?.complete({
          type: "weather_current",
          location,
          temp: mockData.temp,
          description: mockData.description,
        });
        setLoading(false);
        return;
      }

      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=imperial`
      );
      const data = await res.json();

      if (data.cod !== 200) {
        throw new Error(data.message || "Location not found");
      }

      const weatherData: WeatherData = {
        location: data.name,
        temp: Math.round(data.main.temp),
        description: data.weather[0].description,
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed),
        icon: data.weather[0].main.toLowerCase(),
        feelsLike: Math.round(data.main.feels_like),
        high: Math.round(data.main.temp_max),
        low: Math.round(data.main.temp_min),
      };

      setWeather(weatherData);
      sdkRef.current?.updateState({ ...weatherData, type: "current" });
      sdkRef.current?.complete({
        type: "weather_current",
        location: weatherData.location,
        temp: weatherData.temp,
        description: weatherData.description,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch weather";
      setError(msg);
      sdkRef.current?.error(msg, "FETCH_FAILED");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(async (location: string) => {
    setLoading(true);
    setError(null);

    try {
      // Mock forecast data for dev
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const mockForecast: ForecastDay[] = days.map((day, i) => ({
        day,
        high: 75 - i * 2,
        low: 58 + i,
        description: i % 2 === 0 ? "Sunny" : "Partly Cloudy",
        icon: i % 2 === 0 ? "clear" : "cloud",
      }));

      setForecast(mockForecast);
      // Also fetch current weather
      await fetchWeather(location);

      sdkRef.current?.updateState({
        type: "forecast",
        location,
        days: mockForecast,
      });
      sdkRef.current?.complete({
        type: "weather_forecast",
        location,
        days: mockForecast.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch forecast";
      setError(msg);
      sdkRef.current?.error(msg, "FORECAST_FAILED");
    } finally {
      setLoading(false);
    }
  }, [fetchWeather]);

  // Keep refs updated
  fetchWeatherRef.current = fetchWeather;
  fetchForecastRef.current = fetchForecast;

  // --- UI Helpers ---

  const getWeatherIcon = (icon?: string) => {
    switch (icon) {
      case "rain":
      case "drizzle":
        return <CloudRain className="h-16 w-16 text-blue-400" />;
      case "clear":
        return <Sun className="h-16 w-16 text-yellow-400" />;
      case "snow":
        return <CloudSnow className="h-16 w-16 text-blue-200" />;
      case "thunderstorm":
        return <CloudLightning className="h-16 w-16 text-yellow-300" />;
      default:
        return <Cloud className="h-16 w-16 text-zinc-400" />;
    }
  };

  const getSmallWeatherIcon = (icon?: string) => {
    switch (icon) {
      case "rain":
      case "drizzle":
        return <CloudRain className="h-5 w-5 text-blue-400" />;
      case "clear":
        return <Sun className="h-5 w-5 text-yellow-400" />;
      case "snow":
        return <CloudSnow className="h-5 w-5 text-blue-200" />;
      default:
        return <Cloud className="h-5 w-5 text-zinc-400" />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6">
      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          <p className="text-sm text-zinc-400">Fetching weather...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-lg border border-red-800 bg-red-900/20 px-6 py-4 text-center">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Current Weather */}
      {weather && !loading && (
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="mb-4 text-center">
            {getWeatherIcon(weather.icon)}
            <h2 className="mt-2 text-xl font-bold text-zinc-100">{weather.location}</h2>
            <p className="text-sm capitalize text-zinc-400">{weather.description}</p>
          </div>

          <div className="mb-4 text-center">
            <span className="text-5xl font-bold text-zinc-100">{weather.temp}&deg;</span>
            <span className="text-lg text-zinc-500">F</span>
          </div>

          {weather.high !== undefined && weather.low !== undefined && (
            <div className="mb-4 text-center text-xs text-zinc-500">
              H: {weather.high}&deg; &middot; L: {weather.low}&deg;
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center rounded-lg bg-zinc-800 p-3">
              <Thermometer className="mb-1 h-4 w-4 text-red-400" />
              <span className="text-xs text-zinc-500">Feels like</span>
              <span className="text-sm font-medium text-zinc-200">{weather.feelsLike ?? weather.temp}&deg;</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-zinc-800 p-3">
              <Droplets className="mb-1 h-4 w-4 text-blue-400" />
              <span className="text-xs text-zinc-500">Humidity</span>
              <span className="text-sm font-medium text-zinc-200">{weather.humidity}%</span>
            </div>
            <div className="flex flex-col items-center rounded-lg bg-zinc-800 p-3">
              <Wind className="mb-1 h-4 w-4 text-cyan-400" />
              <span className="text-xs text-zinc-500">Wind</span>
              <span className="text-sm font-medium text-zinc-200">{weather.windSpeed} mph</span>
            </div>
          </div>
        </div>
      )}

      {/* Forecast */}
      {forecast && !loading && (
        <div className="mt-4 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-300">5-Day Forecast</h3>
          <div className="space-y-2">
            {forecast.map((day) => (
              <div key={day.day} className="flex items-center justify-between rounded-lg bg-zinc-800 px-3 py-2">
                <span className="w-10 text-xs font-medium text-zinc-400">{day.day}</span>
                {getSmallWeatherIcon(day.icon)}
                <span className="text-xs text-zinc-500 capitalize flex-1 ml-2">{day.description}</span>
                <span className="text-xs font-medium text-zinc-200">{day.high}&deg;</span>
                <span className="text-xs text-zinc-500 ml-1">{day.low}&deg;</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!weather && !loading && !error && (
        <div className="text-center">
          <Cloud className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
          <p className="text-sm text-zinc-500">
            {isEmbedded
              ? "Ask ChatBridge about the weather to get started!"
              : "Weather app ready. Waiting for data..."
            }
          </p>
          {!isEmbedded && (
            <div className="mt-4">
              <button
                onClick={() => fetchWeather("San Francisco")}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white hover:bg-violet-500"
              >
                Demo: San Francisco
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
