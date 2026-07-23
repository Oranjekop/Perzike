import React, { useEffect, useRef, useState } from 'react'
import { Input, InputProps } from '@renderer/components/ui/heroui'
import { FaSearch } from 'react-icons/fa'

interface CollapseInputProps extends InputProps {
  title: string
}

const CollapseInput: React.FC<CollapseInputProps> = (props) => {
  const { title, value, onValueChange, onCompositionEnd, onCompositionStart, ...inputProps } =
    props
  const inputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false)
  const [inputValue, setInputValue] = useState(typeof value === 'string' ? value : '')
  const hasValue = inputValue.length > 0

  useEffect(() => {
    if (isComposingRef.current) return
    setInputValue(typeof value === 'string' ? value : '')
  }, [value])

  return (
    <div className="flex">
      <Input
        size="sm"
        ref={inputRef}
        {...inputProps}
        value={inputValue}
        onValueChange={(nextValue) => {
          setInputValue(nextValue)
          if (!isComposingRef.current) {
            onValueChange?.(nextValue)
          }
        }}
        onCompositionStart={(event) => {
          isComposingRef.current = true
          onCompositionStart?.(event)
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false
          const nextValue = event.currentTarget.value
          setInputValue(nextValue)
          onValueChange?.(nextValue)
          onCompositionEnd?.(event)
        }}
        style={{ paddingInlineEnd: 0 }}
        classNames={{
          inputWrapper:
            'app-inline-input cursor-pointer bg-transparent p-0 data-[hover=true]:bg-content2',
          input: `${hasValue ? 'w-[150px] ml-2' : 'w-0 focus:w-[150px] focus:ml-2'} transition-all duration-200`
        }}
        endContent={
          <div
            className="cursor-pointer p-2 text-lg text-foreground-500"
            onClick={(e) => {
              e.stopPropagation()
              if (inputRef.current?.offsetWidth != 0) {
                inputRef.current?.blur()
              } else {
                inputRef.current?.focus()
              }
            }}
          >
            <FaSearch title={title} />
          </div>
        }
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.focus()
        }}
      />
    </div>
  )
}

export default CollapseInput
