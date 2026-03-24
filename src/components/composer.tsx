import * as React from "react"
import { ArrowUpIcon, StopIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function Composer(props: {
  disabled?: boolean
  error?: string
  isStreaming: boolean
  onAbort: () => void
  onSend: (value: string) => void
}) {
  const [value, setValue] = React.useState("")

  return (
    <div className="border-t border-foreground/10 bg-background/90 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <Textarea
          disabled={props.disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              const nextValue = value
              setValue("")
              props.onSend(nextValue)
            }
          }}
          placeholder="Message the active model. Cmd/Ctrl+Enter sends."
          value={value}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="min-h-4 text-xs text-destructive">{props.error}</div>
          {props.isStreaming ? (
            <Button onClick={props.onAbort} variant="outline">
              <StopIcon />
              Stop
            </Button>
          ) : (
            <Button
              disabled={props.disabled || !value.trim()}
              onClick={() => {
                const nextValue = value
                setValue("")
                props.onSend(nextValue)
              }}
            >
              <ArrowUpIcon />
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
