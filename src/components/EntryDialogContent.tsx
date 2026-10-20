import { useEffect, useRef, type ComponentProps, type CSSProperties } from 'react';
import { DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function EntryDialogContent({ className, children, ...props }: ComponentProps<typeof DialogContent>) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const updateViewport = () => {
      const content = contentRef.current;
      if (!content) return;
      content.style.setProperty('--entry-height', `${viewport?.height ?? window.innerHeight}px`);
      content.style.setProperty('--entry-offset', `${viewport?.offsetTop ?? 0}px`);
    };
    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);
    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  return (
    <DialogContent
      {...props}
      ref={contentRef}
      style={{ '--entry-height': `${window.visualViewport?.height ?? window.innerHeight}px`, '--entry-offset': `${window.visualViewport?.offsetTop ?? 0}px`, ...props.style } as CSSProperties}
      onInteractOutside={event => event.preventDefault()}
      onOpenAutoFocus={event => {
        if (window.matchMedia('(max-width: 639px)').matches) {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }
      }}
      className={cn(
        '!top-[calc(var(--entry-offset)+max(1rem,env(safe-area-inset-top)))] !max-h-[calc(var(--entry-height)-max(1rem,env(safe-area-inset-top))-1rem)] !w-[calc(100%-1.5rem)] !translate-y-0 !animate-none overflow-y-auto overscroll-contain rounded-[2rem] bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:!top-1/2 sm:!max-h-[90dvh] sm:!w-full sm:!-translate-y-1/2 sm:p-6 [&_input]:!text-base [&_textarea]:!text-base [&_select]:!text-base [&>div:first-child]:pr-9 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:h-10 [&>button]:w-10 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full',
        className,
      )}
    >
      {children}
    </DialogContent>
  );
}
