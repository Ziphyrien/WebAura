import { createFileRoute } from "@tanstack/react-router";

const COLLECTOR_URL = "https://collector.onedollarstats.com/events";

function setCorsHeaders(headers: Headers) {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("cache-control", "no-cache");
}

export const Route = createFileRoute("/api/e")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        if (request.method === "OPTIONS") {
          const headers = new Headers();
          setCorsHeaders(headers);
          return new Response("", { headers, status: 204 });
        }

        const forwardHeaders = new Headers();

        const forwardedFor =
          request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");

        if (forwardedFor) {
          forwardHeaders.set("x-forwarded-for", forwardedFor);
        }

        const clientCountry = request.headers.get("x-vercel-ip-country");
        if (clientCountry) {
          forwardHeaders.set("x-client-country", clientCountry);
        }

        const clientRegion = request.headers.get("x-vercel-ip-country-region");
        if (clientRegion) {
          forwardHeaders.set("x-client-region", clientRegion);
        }

        const clientCity = request.headers.get("x-vercel-ip-city");
        if (clientCity) {
          forwardHeaders.set("x-client-city", clientCity);
        }

        const userAgent = request.headers.get("user-agent");
        if (userAgent) {
          forwardHeaders.set("user-agent", userAgent);
        }

        const contentType = request.headers.get("content-type");
        if (contentType) {
          forwardHeaders.set("content-type", contentType);
        }

        const referer = request.headers.get("referer");
        if (referer) {
          forwardHeaders.set("referer", referer);
        }

        const origin = request.headers.get("origin");
        if (origin) {
          forwardHeaders.set("origin", origin);
        }

        const body =
          request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

        const response = await fetch(COLLECTOR_URL, {
          body,
          headers: forwardHeaders,
          method: request.method,
        });

        const responseHeaders = new Headers(response.headers);
        setCorsHeaders(responseHeaders);
        responseHeaders.set(
          "content-type",
          response.headers.get("content-type") ?? "application/json",
        );

        if (!response.body) {
          const headers = new Headers();
          setCorsHeaders(headers);
          headers.set("content-type", response.headers.get("content-type") ?? "application/json");
          return new Response("", {
            headers,
            status: response.status,
          });
        }

        return new Response(response.body, {
          headers: responseHeaders,
          status: response.status,
          statusText: response.statusText,
        });
      },
    },
  },
});
