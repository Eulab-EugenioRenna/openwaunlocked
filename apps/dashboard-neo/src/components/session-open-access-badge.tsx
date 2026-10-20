import { Unlock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@open-wa/ui-components/popover"
import { useRuntimeFeatures } from "@/lib/hooks/use-runtime-features"
import { useSession } from "@/lib/hooks/use-session"

export function SessionOpenAccessBadge() {
  const runtime = useRuntimeFeatures()
  const { session } = useSession()
  return <Popover>
    <PopoverTrigger asChild>
      <Button type="button" variant="outline" size="sm" className="ow-license-foil shadow-none" aria-label="Eulab Open API access">
        <Unlock size={14} /><span className="hidden sm:inline">Open</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} className="w-80 max-w-[calc(100vw-1rem)] rounded-2xl p-4 text-popover-foreground">
      <p className="text-sm font-semibold">Eulab Open</p>
      <p className="mt-2 text-xs text-muted-foreground">Open API access in this development branch. No activation key or purchase is required. Maintained by Eulab.</p>
      <p className="mt-3 text-xs">Session: <code>{session.sessionId || "Unavailable"}</code></p>
      <p className="mt-2 text-xs text-muted-foreground">Availability depends on the connected WhatsApp session and native provider. Open access does not certify physical test results.</p>
      {runtime.source === "demo" && <p className="mt-2 text-xs text-muted-foreground">Demo data. No live session is verified.</p>}
      {Object.keys(runtime.features).length > 0 && <div className="mt-4 border-t pt-3">
        <p className="mb-2 text-xs font-semibold">Runtime features</p>
        <dl className="max-h-56 space-y-2 overflow-auto text-xs">
          {Object.entries(runtime.features).sort(([a], [b]) => a.localeCompare(b)).map(([feature, available]) => <div key={feature} className="flex items-center justify-between gap-3">
            <dt className="min-w-0 truncate" title={feature}>{({ patch_calls_control: "Call controls", patch_calls_audio: "Call audio", patch_calls_video: "Call video" } as Record<string, string>)[feature] ?? feature.replace(/^patch_/, "").replace(/_/g, " ")}</dt>
            <dd className="shrink-0">{available ? "Available" : "Unavailable"}</dd>
          </div>)}
        </dl>
      </div>}
      {runtime.state === "unavailable" && <p className="mt-3 text-xs text-muted-foreground">Runtime feature metadata is unavailable.</p>}
    </PopoverContent>
  </Popover>
}
