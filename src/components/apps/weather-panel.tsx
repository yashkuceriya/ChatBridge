"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Cloud,
  Sun,
  CloudRain,
  Droplets,
  Wind,
  Thermometer,
  X,
  Sunrise,
  Sunset,
  Eye,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  MapPin,
  RefreshCw,
} from "lucide-react";

interface WeatherData {
  location: string;
  temp: number;
  description: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  feelsLike?: number;
  visibility?: number;
  pressure?: number;
}

interface ForecastDay {
  day: string;
  icon: string;
  high: number;
  low: number;
}

interface WeatherPanelProps {
  sessionId: string;
  args: { location: string } & Record<string, unknown>;
  onStateUpdate: (state: Record<string, unknown>) => void;
  onComplete: (result: Record<string, unknown>) => void;
  onClose: () => void;
}

// --- Animated weather icons ---

function AnimatedSun({ size = "large" }: { size?: "large" | "small" }) {
  const dim = size === "large" ? "h-20 w-20" : "h-6 w-6";
  const rayDim = size === "large" ? "h-24 w-24" : "h-8 w-8";
  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      <div className={`absolute ${rayDim} animate-[spin_12s_linear_infinite] opacity-40`}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <div
            key={deg}
            className="absolute left-1/2 top-0 h-1/2 w-[2px] origin-bottom"
            style={{
              transform: `rotate(${deg}deg)`,
              background: "linear-gradient(to top, transparent, #fbbf24)",
            }}
          />
        ))}
      </div>
      <Sun className={`${dim} text-amber-400 drop-shadow-[0_0_12px_rgba(251,191,36,0.5)]`} />
    </div>
  );
}

function AnimatedRain({ size = "large" }: { size?: "large" | "small" }) {
  const dim = size === "large" ? "h-20 w-20" : "h-6 w-6";
  const isLarge = size === "large";
  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      <CloudRain className={`${dim} text-blue-400`} />
      {isLarge && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-6 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="absolute w-[2px] rounded-full bg-blue-400/70"
              style={{
                left: `${15 + i * 17}%`,
                height: "8px",
                animation: `rainDrop 0.8s ease-in infinite`,
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AnimatedCloud({ size = "large" }: { size?: "large" | "small" }) {
  const dim = size === "large" ? "h-20 w-20" : "h-6 w-6";
  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      <Cloud
        className={`${dim} text-zinc-400`}
        style={{ animation: "floatCloud 4s ease-in-out infinite" }}
      />
    </div>
  );
}

function AnimatedSnow({ size = "large" }: { size?: "large" | "small" }) {
  const dim = size === "large" ? "h-20 w-20" : "h-6 w-6";
  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      <CloudSnow className={`${dim} text-blue-200`} />
    </div>
  );
}

function AnimatedStorm({ size = "large" }: { size?: "large" | "small" }) {
  const dim = size === "large" ? "h-20 w-20" : "h-6 w-6";
  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      <CloudLightning className={`${dim} text-yellow-300`} />
    </div>
  );
}

function AnimatedDrizzle({ size = "large" }: { size?: "large" | "small" }) {
  const dim = size === "large" ? "h-20 w-20" : "h-6 w-6";
  return (
    <div className={`relative ${dim} flex items-center justify-center`}>
      <CloudDrizzle className={`${dim} text-blue-300`} />
    </div>
  );
}

// --- Gradient backgrounds per condition ---

function getConditionGradient(icon?: string): string {
  switch (icon) {
    case "clear":
      return "from-amber-900/40 via-orange-900/20 to-zinc-950";
    case "rain":
      return "from-blue-900/40 via-slate-900/30 to-zinc-950";
    case "drizzle":
      return "from-blue-800/30 via-slate-900/20 to-zinc-950";
    case "snow":
      return "from-blue-100/10 via-slate-900/20 to-zinc-950";
    case "thunderstorm":
      return "from-purple-900/30 via-slate-900/30 to-zinc-950";
    case "clouds":
    case "cloud":
    default:
      return "from-slate-700/30 via-zinc-900/30 to-zinc-950";
  }
}

function getConditionAccent(icon?: string): string {
  switch (icon) {
    case "clear":
      return "text-amber-400";
    case "rain":
    case "drizzle":
      return "text-blue-400";
    case "snow":
      return "text-blue-200";
    case "thunderstorm":
      return "text-yellow-300";
    default:
      return "text-zinc-400";
  }
}

// --- Mock forecast generator ---

function generateForecast(baseTemp: number, icon: string): ForecastDay[] {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const conditions = ["clear", "cloud", "rain", "clear", "cloud"];
  const today = new Date().getDay();
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return days.map((_, i) => {
    const dayIndex = (today + i + 1) % 7;
    const tempVariation = Math.floor(Math.random() * 8) - 3;
    const high = baseTemp + tempVariation + Math.floor(Math.random() * 4);
    const low = baseTemp + tempVariation - Math.floor(Math.random() * 8) - 4;
    return {
      day: dayNames[dayIndex],
      icon: i === 0 ? icon : conditions[i],
      high,
      low,
    };
  });
}

// --- Sunrise/sunset mock ---

function getMockSunTimes(): { sunrise: string; sunset: string } {
  return { sunrise: "6:42 AM", sunset: "7:18 PM" };
}

export function WeatherPanel({
  sessionId,
  args,
  onStateUpdate,
  onComplete,
  onClose,
}: WeatherPanelProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const forecast = useMemo(() => {
    if (!weather) return [];
    return generateForecast(weather.temp, weather.icon);
  }, [weather]);

  const sunTimes = getMockSunTimes();

  const getWeatherIcon = (icon?: string, size: "large" | "small" = "large") => {
    switch (icon) {
      case "rain":
        return <AnimatedRain size={size} />;
      case "drizzle":
        return <AnimatedDrizzle size={size} />;
      case "clear":
        return <AnimatedSun size={size} />;
      case "snow":
        return <AnimatedSnow size={size} />;
      case "thunderstorm":
        return <AnimatedStorm size={size} />;
      default:
        return <AnimatedCloud size={size} />;
    }
  };

  const getForecastIcon = (icon: string) => {
    return getWeatherIcon(icon, "small");
  };

  const fetchWeather = useCallback(async (location: string) => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;

      if (!apiKey) {
        const mockData: WeatherData = {
          location,
          temp: 72,
          description: "Partly Cloudy",
          humidity: 45,
          windSpeed: 8,
          icon: "cloud",
          feelsLike: 69,
          visibility: 10,
          pressure: 1015,
        };
        setWeather(mockData);
        setLastUpdated(new Date());
        onStateUpdate({ ...mockData });
        onComplete({ ...mockData, source: "mock" });
        setLoading(false);
        return;
      }

      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
          location
        )}&appid=${apiKey}&units=imperial`
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
        visibility: data.visibility ? Math.round(data.visibility / 1609) : undefined,
        pressure: data.main.pressure,
      };

      setWeather(weatherData);
      setLastUpdated(new Date());
      onStateUpdate({ ...weatherData });
      onComplete({ ...weatherData, source: "openweather" });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch weather";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [onStateUpdate, onComplete]);

  useEffect(() => {
    if (args.location) {
      fetchWeather(args.location);
    } else {
      setLoading(false);
      setError("No location provided");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gradient = getConditionGradient(weather?.icon);
  const accent = getConditionAccent(weather?.icon);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Animated CSS */}
      <style>{`
        @keyframes rainDrop {
          0% { opacity: 0; transform: translateY(-8px); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(16px); }
        }
        @keyframes floatCloud {
          0%, 100% { transform: translateX(0) translateY(0); }
          50% { transform: translateX(4px) translateY(-3px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in-up {
          animation: fadeInUp 0.5s ease-out both;
        }
        .fade-in-up-delay-1 { animation-delay: 0.1s; }
        .fade-in-up-delay-2 { animation-delay: 0.2s; }
        .fade-in-up-delay-3 { animation-delay: 0.3s; }
        .fade-in-up-delay-4 { animation-delay: 0.4s; }
      `}</style>

      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-b ${gradient} pointer-events-none transition-all duration-1000`} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/5 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md bg-white/5 ${accent}`}>
            <Cloud className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-zinc-100">Weather</span>
          {loading && (
            <span className="rounded-full bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
              Loading
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-white/10 border-t-white/50" />
            </div>
            <p className="text-sm text-zinc-400 font-medium">Fetching weather data...</p>
          </div>
        )}

        {error && !loading && (
          <div className="p-4">
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-center backdrop-blur-sm">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          </div>
        )}

        {weather && !loading && (
          <div className="p-4 space-y-4">
            {/* Main weather card */}
            <div className="fade-in-up rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-6">
              {/* Location */}
              <div className="flex items-center justify-center gap-1.5 mb-4">
                <MapPin className={`h-3.5 w-3.5 ${accent}`} />
                <span className="text-sm font-medium text-zinc-300">{weather.location}</span>
              </div>

              {/* Icon + Temp */}
              <div className="flex items-center justify-center gap-6 mb-2">
                {getWeatherIcon(weather.icon)}
                <div className="text-center">
                  <div className="flex items-start justify-center">
                    <span className="text-7xl font-extralight text-white tracking-tighter leading-none">
                      {weather.temp}
                    </span>
                    <span className="text-2xl font-light text-zinc-400 mt-2">&deg;F</span>
                  </div>
                  <p className="text-sm text-zinc-400 mt-1">
                    Feels like{" "}
                    <span className="text-zinc-300 font-medium">
                      {weather.feelsLike ?? weather.temp}&deg;
                    </span>
                  </p>
                </div>
              </div>

              {/* Description */}
              <p className="text-center text-sm capitalize text-zinc-400 mt-3 mb-5">
                {weather.description}
              </p>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.04] px-3.5 py-3">
                  <Droplets className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-zinc-500 leading-none mb-0.5">Humidity</p>
                    <p className="text-sm font-medium text-zinc-200">{weather.humidity}%</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.04] px-3.5 py-3">
                  <Wind className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-zinc-500 leading-none mb-0.5">Wind</p>
                    <p className="text-sm font-medium text-zinc-200">{weather.windSpeed} mph</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.04] px-3.5 py-3">
                  <Eye className="h-4 w-4 text-zinc-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-zinc-500 leading-none mb-0.5">Visibility</p>
                    <p className="text-sm font-medium text-zinc-200">
                      {weather.visibility ?? 10} mi
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.04] px-3.5 py-3">
                  <Thermometer className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-zinc-500 leading-none mb-0.5">Pressure</p>
                    <p className="text-sm font-medium text-zinc-200">
                      {weather.pressure ?? 1015} hPa
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sunrise / Sunset */}
            <div className="fade-in-up fade-in-up-delay-1 flex gap-2.5">
              <div className="flex-1 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md px-4 py-3">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Sunrise className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 leading-none mb-0.5">Sunrise</p>
                  <p className="text-sm font-medium text-zinc-200">{sunTimes.sunrise}</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md px-4 py-3">
                <div className="p-1.5 rounded-lg bg-orange-500/10">
                  <Sunset className="h-4 w-4 text-orange-400" />
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 leading-none mb-0.5">Sunset</p>
                  <p className="text-sm font-medium text-zinc-200">{sunTimes.sunset}</p>
                </div>
              </div>
            </div>

            {/* 5-Day Forecast */}
            <div className="fade-in-up fade-in-up-delay-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-3">
                5-Day Forecast
              </p>
              <div className="grid grid-cols-5 gap-1">
                {forecast.map((day, i) => (
                  <div
                    key={day.day}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1 hover:bg-white/[0.03] transition-colors"
                  >
                    <span className="text-[11px] font-medium text-zinc-500">{day.day}</span>
                    {getForecastIcon(day.icon)}
                    <div className="flex flex-col items-center">
                      <span className="text-xs font-semibold text-zinc-200">{day.high}&deg;</span>
                      <span className="text-[11px] text-zinc-500">{day.low}&deg;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Last updated footer */}
            <div className="fade-in-up fade-in-up-delay-3 flex items-center justify-between px-1">
              <p className="text-[11px] text-zinc-600">
                {process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
                  ? "OpenWeather"
                  : "Mock data"}
              </p>
              <div className="flex items-center gap-1.5">
                {lastUpdated && (
                  <p className="text-[11px] text-zinc-600">
                    Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                <button
                  onClick={() => args.location && fetchWeather(args.location)}
                  className="p-1 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
