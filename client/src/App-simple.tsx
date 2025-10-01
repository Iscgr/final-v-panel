import { Switch, Route, useLocation } from "wouter";
import { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

// Pages
import Dashboard from "./pages/dashboard-simple";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Suspense fallback={
          <div className="flex h-screen items-center justify-center">
            <div className="text-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-sm text-muted-foreground">در حال بارگذاری...</p>
            </div>
          </div>
        }>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route>
              {() => (
                <div className="flex h-screen items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-2xl font-bold">صفحه یافت نشد</h1>
                    <p className="mt-2 text-muted-foreground">صفحه مورد نظر شما یافت نشد.</p>
                  </div>
                </div>
              )}
            </Route>
          </Switch>
        </Suspense>
      </div>
    </QueryClientProvider>
  );
}

export default App;