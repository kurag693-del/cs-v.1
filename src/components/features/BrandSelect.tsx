'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface BrandSelectProps {
  brands: Array<{ id: string; name: string }>
  onBrandSelect?: (brandId: string) => void
  selectedBrandId?: string
}

export function BrandSelect({ brands, onBrandSelect, selectedBrandId }: BrandSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedBrand = brands.find(b => b.id === selectedBrandId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selectedBrand ? selectedBrand.name : 'Select brand...'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search brands..." />
          <CommandEmpty>No brand found.</CommandEmpty>
          <CommandGroup>
            <CommandItem
              key="__none"
              value=""
              onSelect={() => {
                onBrandSelect?.('')
                setOpen(false)
              }}
            >
              <Check
                className={cn(
                  'mr-2 h-4 w-4',
                  !selectedBrandId ? 'opacity-100' : 'opacity-0'
                )}
              />
              None
            </CommandItem>
            {brands.map((brand) => (
              <CommandItem
                key={brand.id}
                value={brand.name}
                onSelect={() => {
                  onBrandSelect?.(brand.id)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    selectedBrandId === brand.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {brand.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
