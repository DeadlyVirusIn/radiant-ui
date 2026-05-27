import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="font-display text-7xl font-bold tracking-tight text-foreground">404</div>
        <h2 className="mt-3 font-display text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The screen you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">This view didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong while rendering. Retry, or head back to the dashboard.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Radiant — AI Operations Console" },
      { name: "description", content: "Premium operations console for hunts, trades, gold flair, fleet and analytics." },
      { name: "theme-color", content: "#0B1020" },
      { property: "og:title", content: "Radiant — AI Operations Console" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Urbanist:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

const themeInitScript = `(() => { try {
  var s = localStorage.getItem('radiant.theme');
  var t = s === 'light' || s === 'dark' ? s
    : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.classList.add(t);
} catch (e) { document.documentElement.classList.add('dark'); } })();`;

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
          <AppSidebar />
          <SidebarInset className="flex min-h-screen min-w-0 flex-1 flex-col">
            <AppHeader />
            <main className="flex-1 bg-glow-primary">
              <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8">
                <Outlet />
              </div>
            </main>
          </SidebarInset>
        </div>
        <Toaster />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
