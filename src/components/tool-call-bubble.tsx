import type { ToolCall } from "@/types/chat"
import { Badge } from "@/components/ui/badge"

export function ToolCallBubble(props: { toolCall: ToolCall }) {
  return (
    <div className="rounded-none border border-foreground/10 bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>Tool call</span>
        <Badge className="rounded-none" variant="outline">
          {props.toolCall.name}
        </Badge>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 text-foreground/80">
        {JSON.stringify(props.toolCall.arguments, null, 2)}
      </pre>
    </div>
  )
}
