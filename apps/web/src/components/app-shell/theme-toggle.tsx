"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/hooks/use-has-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // resolvedTheme is unknown at SSR time (it depends on localStorage/system
  // preference, both client-only) and can differ from what the client
  // resolves on its very first render, so the server and the pre-hydration
  // client would pick different icons — a hydration mismatch. Rendering the
  // same icon on both until after mount avoids it; `setTheme` itself doesn't
  // need the guard since it's only reachable via a click, which can't happen
  // before hydration.
  const mounted = useHasMounted();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-[18px]" />
      ) : (
        <Moon className="size-[18px]" />
      )}
    </Button>
  );
}
