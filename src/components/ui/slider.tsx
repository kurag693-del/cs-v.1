"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SliderProps = {
  min?: number;
  max?: number;
  step?: number;
  value?: number[];
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
  className?: string;
};

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ min = 0, max = 100, step = 1, value = [0], onValueChange, disabled, className }, ref) => (
    <input
      ref={ref}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value[0] ?? min}
      disabled={disabled}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
      className={cn("h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary", className)}
    />
  )
);
Slider.displayName = "Slider";

export { Slider };
