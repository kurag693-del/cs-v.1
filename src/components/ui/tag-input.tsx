'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
}

export function TagInput({ tags, onChange, placeholder, className }: TagInputProps) {
  const [input, setInput] = React.useState('')

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const value = input.trim()
      if (value && !tags.includes(value)) {
        onChange([...tags, value])
        setInput('')
      }
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className={cn('flex w-full min-w-0 flex-wrap items-start gap-2 rounded-md border border-input bg-background p-2', className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex max-w-full items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
        >
          <span className="truncate">{tag}</span>
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="ml-1 rounded-full hover:bg-secondary-foreground/20"
          >
            <X className="h-3 w-3" />
            <span className="sr-only">Удалить {tag}</span>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 w-full min-w-0 flex-[1_1_10rem] appearance-none border-0 bg-transparent px-0 py-0 text-sm shadow-none outline-none ring-0 focus:outline-none focus:ring-0"
      />
    </div>
  )
}
