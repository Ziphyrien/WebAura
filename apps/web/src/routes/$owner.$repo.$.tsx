import { createFileRoute } from "@tanstack/react-router";
import { resolveRepoIntent } from "@gitinspect/pi/repo/ref-resolver";
import { Chat } from "@gitinspect/ui/components/chat";
import { parseRepoRoutePath } from "@gitinspect/pi/repo/path-parser";
import { toResolvedRepoSource } from "@gitinspect/pi/repo/path-intent";

type RepoSplatSearch = {
  q?: string;
};

export const Route = createFileRoute("/$owner/$repo/$")({
  loader: async ({ params }) => {
    const decodedSplat = decodePathFragment(params._splat ?? "");
    const intent = parseRepoRoutePath(`/${params.owner}/${params.repo}/${decodedSplat}`);
    return toResolvedRepoSource(await resolveRepoIntent(intent));
  },
  validateSearch: (search: RepoSplatSearch) => ({
    q: typeof search.q === "string" && search.q.trim().length > 0 ? search.q : undefined,
  }),
  component: RepoChatRoute,
});

function RepoChatRoute() {
  const repoSource = Route.useLoaderData();

  return <Chat repoSource={repoSource} />;
}

function decodePathFragment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
