'use client'

import * as React from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface ColorPickerProps {
  colors: string[]
  onChange: (colors: string[]) => void
  maxColors?: number
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
  '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
  '#000000', '#6B7280', '#9CA3AF', '#D1D5DB', '#FFFFFF',
]

export function ColorPicker({ colors, onChange, maxColors = 5 }: ColorPickerProps) {
  const [customColor, setCustomColor] = React.useState('#')

  const addColor = (color: string) => {
    if (colors.length >= maxColors) return
    if (!colors.includes(color)) {
      onChange([...colors, color])
    }
  }

  const removeColor = (colorToRemove: string) => {
    onChange(colors.filter((c) => c !== colorToRemove))
  }

  const handleCustomColor = () => {
    if (customColor && customColor.length === 7 && !colors.includes(customColor)) {
      addColor(customColor)
      setCustomColor('#')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <div key={color} className="flex items-center gap-1">
            <div
              className="h-6 w-6 rounded-full border-2 border-white shadow-sm"
              style={{ backgroundColor: color }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => removeColor(color)}
            >
              ✕
            </Button>
          </div>
        ))}
        {colors.length < maxColors && (
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            onBlur={handleCustomColor}
            className="h-6 w-6 cursor-pointer rounded border-none p-0"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => addColor(color)}
            disabled={colors.length >= maxColors && !colors.includes(color)}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-all',
              colors.includes(color)
                ? 'border-black scale-110'
                : 'border-white hover:scale-110',
              colors.length >= maxColors && !colors.includes(color)
                ? 'opacity-30 cursor-not-allowed'
                : ''
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Выбрано {colors.length} из {maxColors} цветов
      </p>
    </div>
  )
}
