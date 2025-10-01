import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { cn } from "@/lib/utils";

export default function Header() {
  const { openMobileSidebar } = useSidebar();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Button
        variant="outline"
        size="icon"
        className="shrink-0 md:hidden"
        onClick={openMobileSidebar}
        aria-label="باز کردن منو"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="w-full flex-1">
        {/* Search bar can go here */}
      </div>
      <div>
        {/* User profile, settings dropdown can go here */}
      </div>
    </header>
  );
}