"use client";

import Link from "next/link";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { normalizeObservabilityError } from "@/lib/observability/cost-log";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class ErrorBoundaryInner extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const normalized = normalizeObservabilityError(error);
    return {
      hasError: true,
      message: normalized.message,
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    const normalized = normalizeObservabilityError(error);
    console.error("Dashboard boundary error:", {
      ...normalized,
      componentStack: errorInfo.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      message: "",
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <Card className="mx-auto max-w-xl">
        <CardHeader>
          <CardTitle>Ошибка в разделе дашборда</CardTitle>
          <CardDescription>
            Интерфейс не смог корректно отобразить данные. Попробуйте повторить действие или вернуться на главную.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{this.state.message || "Неизвестная ошибка"}</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={this.handleRetry}>Попробовать снова</Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Вернуться на главную</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return <ErrorBoundaryInner>{children}</ErrorBoundaryInner>;
}
