import { env } from "@gitinspect/env/server";
import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_HOSTS = new Set(["api.fireworks.ai"]);

export const Route = createFileRoute("/api/proxy")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get("url");

        if (!targetUrl) {
          return Response.json({ error: "Missing ?url= parameter" }, { status: 400 });
        }

        let target: URL;
        try {
          target = new URL(targetUrl);
        } catch {
          return Response.json({ error: "Invalid target URL" }, { status: 400 });
        }

        if (!ALLOWED_HOSTS.has(target.host)) {
          return Response.json({ error: `Host not allowed: ${target.host}` }, { status: 403 });
        }

        const apiKey = env.FIREWORKS_API_KEY;
        if (!apiKey) {
          return Response.json({ error: "Server proxy is not configured" }, { status: 503 });
        }

        if (request.method === "OPTIONS") {
          return new Response("", {
            headers: {
              "access-control-allow-headers": "content-type, authorization",
              "access-control-allow-methods": "GET, POST, OPTIONS",
              "access-control-allow-origin": "*",
            },
          });
        }

        const forwardHeaders = new Headers({
          authorization: `Bearer ${apiKey}`,
        });

        const contentType = request.headers.get("content-type");
        if (contentType) {
          forwardHeaders.set("content-type", contentType);
        }

        for (const [key, value] of request.headers.entries()) {
          if (key.startsWith("x-")) {
            forwardHeaders.set(key, value);
          }
        }

        let body: string | undefined;
        if (request.method !== "GET" && request.method !== "HEAD") {
          body = await request.text();
        }

        const response = await fetch(target.toString(), {
          body,
          headers: forwardHeaders,
          method: request.method,
        });

        if (!response.body) {
          return new Response("", {
            headers: {
              "access-control-allow-origin": "*",
              "cache-control": "no-cache",
              "content-type": response.headers.get("content-type") ?? "application/json",
            },
            status: response.status,
          });
        }

        const headers = new Headers(response.headers);
        headers.set("content-type", response.headers.get("content-type") ?? "application/json");
        headers.set("cache-control", "no-cache");
        headers.set("access-control-allow-origin", "*");

        return new Response(response.body, {
          headers,
          status: response.status,
          statusText: response.statusText,
        });
      },
    },
  },
});
