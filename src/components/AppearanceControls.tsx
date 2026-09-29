import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';

export function AppearanceControls() {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-border bg-bg p-0.5" data-testid="appearance-controls">
      <LanguageToggle />
      <span className="h-5 w-px bg-border" aria-hidden="true" />
      <ThemeToggle compact />
    </div>
  );
}
