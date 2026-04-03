"use client";

import { useEffect, useState, useCallback } from "react";

interface AppInfo {
  appId: string;
  name: string;
  description: string;
  icon?: string;
  auth: "none" | "api_key" | "oauth2";
  reviewStatus: "unreviewed" | "reviewed" | "approved";
  enabled: boolean;
  permissions: string[];
  version: string;
}

interface PolicyResponse {
  policy: {
    userId: string;
    role: string;
    enabledApps: string[];
  };
  apps: AppInfo[];
  securityPosture: string;
}

const AUTH_LABELS: Record<string, string> = {
  none: "No Auth",
  api_key: "API Key",
  oauth2: "OAuth 2.0",
};

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  reviewed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  unreviewed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function TeacherControls() {
  const [data, setData] = useState<PolicyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/policies");
      if (!res.ok) throw new Error("Failed to fetch policies");
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const toggleApp = async (appId: string, enabled: boolean) => {
    setToggling(appId);
    try {
      const res = await fetch("/api/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, enabled }),
      });
      if (!res.ok) throw new Error("Failed to update policy");
      // Refresh the full state
      await fetchPolicy();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const enabledCount = data.apps.filter((a) => a.enabled).length;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Teacher Controls
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage which apps are available to students in this class.
        </p>
      </div>

      {/* Security posture badge */}
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-700">
          Default Deny
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {enabledCount} of {data.apps.length} apps enabled
        </span>
      </div>

      {/* App list */}
      <div className="space-y-3">
        {data.apps.map((app) => (
          <div
            key={app.appId}
            className={`
              border rounded-lg p-4 transition-colors
              ${
                app.enabled
                  ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
              }
            `}
          >
            <div className="flex items-center justify-between">
              {/* App info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Icon */}
                <span className="text-2xl flex-shrink-0" role="img">
                  {app.icon || "?"}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {app.name}
                    </h3>
                    {/* Review status badge */}
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[app.reviewStatus] || STATUS_COLORS.unreviewed
                      }`}
                    >
                      {app.reviewStatus}
                    </span>
                    {/* Auth badge */}
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-300">
                      {AUTH_LABELS[app.auth] || app.auth}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    {app.description}
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                role="switch"
                aria-checked={app.enabled}
                aria-label={`${app.enabled ? "Disable" : "Enable"} ${app.name}`}
                disabled={toggling === app.appId}
                onClick={() => toggleApp(app.appId, !app.enabled)}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                  rounded-full border-2 border-transparent transition-colors
                  duration-200 ease-in-out focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:ring-offset-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${app.enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}
                `}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform
                    rounded-full bg-white shadow ring-0 transition
                    duration-200 ease-in-out
                    ${app.enabled ? "translate-x-5" : "translate-x-0"}
                  `}
                />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer info */}
      <div className="mt-6 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-4">
        <p>
          Only approved apps can be enabled. Students will not see disabled apps
          in their chat. All tool invocations are logged for FERPA compliance.
        </p>
      </div>
    </div>
  );
}
