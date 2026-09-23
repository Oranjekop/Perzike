import React, { forwardRef, useState } from 'react'
import * as Hero from '@heroui/react'
import { cn, colorStyle, type Appearance, type Classes } from './shared'

export interface ButtonProps
  extends Omit<Hero.ButtonProps, 'variant' | 'className' | 'size' | 'children'>, Appearance {
  title?: string
  children?: React.ReactNode
  variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost'
  isLoading?: boolean
  disabled?: boolean
  fullWidth?: boolean
  startContent?: React.ReactNode
  endContent?: React.ReactNode
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    color = 'default',
    size = 'md',
    radius,
    variant = 'solid',
    isLoading,
    disabled,
    isDisabled,
    isIconOnly,
    fullWidth,
    startContent,
    endContent,
    children,
    className,
    style,
    ...props
  },
  ref
) {
  return (
    <Hero.Button
      {...props}
      aria-label={props['aria-label'] ?? props.title}
      ref={ref}
      variant="tertiary"
      size={size}
      isIconOnly={isIconOnly}
      isDisabled={disabled || isDisabled || isLoading}
      data-ui-color={color}
      data-ui-variant={variant}
      data-ui-size={size}
      data-ui-radius={radius}
      data-loading={isLoading || undefined}
      className={cn('ui-button', fullWidth && 'w-full', className)}
      style={{ ...colorStyle(color), ...style }}
    >
      {isLoading ? <Hero.Spinner size="sm" color="current" /> : startContent}
      {!(isLoading && isIconOnly) && children}
      {!(isLoading && isIconOnly) && endContent}
    </Hero.Button>
  )
})

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'color'>, Appearance {
  classNames?: Classes
  onValueChange?: (value: string) => void
  startContent?: React.ReactNode
  endContent?: React.ReactNode
  isClearable?: boolean
  onClear?: () => void
  isDisabled?: boolean
  fullWidth?: boolean
  variant?: 'flat' | 'bordered' | 'underlined' | 'faded'
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    className,
    classNames = {},
    color: _color,
    radius,
    variant = 'flat',
    onValueChange,
    startContent,
    endContent,
    isClearable,
    onClear,
    isDisabled,
    disabled,
    fullWidth: _fullWidth,
    value,
    defaultValue,
    onChange,
    style,
    ...props
  },
  ref
) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '')
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const currentValue = value ?? uncontrolled
  const update = (next: string): void => {
    setUncontrolled(next)
    onValueChange?.(next)
  }
  return (
    <div
      data-slot="base"
      data-focus={focused || undefined}
      className={cn('ui-input group', className, classNames.base)}
      style={style}
    >
      <div
        data-slot="input-wrapper"
        data-focus={focused || undefined}
        data-hover={hovered || undefined}
        data-ui-size={size}
        data-ui-radius={radius}
        data-ui-variant={variant}
        className={cn('ui-input-wrapper bg-default-100', classNames.inputWrapper)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
        }}
      >
        <div data-slot="inner-wrapper" className={cn('ui-input-inner', classNames.innerWrapper)}>
          {startContent}
          <Hero.Input
            {...props}
            ref={ref}
            disabled={disabled || isDisabled}
            value={currentValue}
            aria-label={props['aria-label'] ?? props.title ?? props.placeholder ?? '输入'}
            onChange={(event) => {
              update(event.target.value)
              onChange?.(event)
            }}
            data-slot="input"
            className={cn('ui-input-field', classNames.input)}
          />
          {isClearable && currentValue !== '' ? (
            <Hero.Button
              aria-label="清除输入"
              isIconOnly
              variant="ghost"
              className="ui-input-clear"
              isDisabled={disabled || isDisabled}
              onPress={() => {
                update('')
                onClear?.()
              }}
            >
              ×
            </Hero.Button>
          ) : (
            endContent
          )}
        </div>
      </div>
    </div>
  )
})

export interface SwitchProps
  extends Omit<Hero.SwitchProps, 'className' | 'onChange' | 'children'>, Appearance {
  classNames?: Classes
  onValueChange?: (selected: boolean) => void
  children?: React.ReactNode
}
export function Switch({
  className,
  classNames = {},
  size = 'md',
  color = 'primary',
  radius: _radius,
  onValueChange,
  children,
  ...props
}: SwitchProps): React.JSX.Element {
  return (
    <Hero.Switch
      {...props}
      isSelected={'isSelected' in props ? (props.isSelected ?? false) : undefined}
      size={size}
      onChange={onValueChange}
      aria-label={props['aria-label'] ?? (typeof children === 'string' ? children : '开关')}
      className={cn('ui-switch', className, classNames.base)}
      style={colorStyle(color)}
    >
      <Hero.Switch.Content
        aria-label={props['aria-label'] ?? (typeof children === 'string' ? children : '开关')}
      >
        <Hero.Switch.Control data-slot="wrapper" className={classNames.wrapper}>
          <Hero.Switch.Thumb data-slot="thumb" className={classNames.thumb} />
        </Hero.Switch.Control>
        {children && <Hero.Label>{children}</Hero.Label>}
      </Hero.Switch.Content>
    </Hero.Switch>
  )
}

export interface CheckboxProps
  extends Omit<Hero.CheckboxProps, 'className' | 'children' | 'onChange'>, Appearance {
  checked?: boolean
  children?: React.ReactNode
  onValueChange?: (selected: boolean) => void
}
export function Checkbox({
  checked,
  isSelected,
  onValueChange,
  className,
  children,
  color = 'primary',
  size = 'md',
  radius: _radius,
  ...props
}: CheckboxProps): React.JSX.Element {
  return (
    <Hero.Checkbox
      {...props}
      isSelected={isSelected ?? checked}
      onChange={onValueChange}
      className={cn('ui-checkbox', className)}
      style={colorStyle(color)}
    >
      <Hero.Checkbox.Content>
        <Hero.Checkbox.Control>
          <Hero.Checkbox.Indicator />
        </Hero.Checkbox.Control>
        <Hero.Label>{children}</Hero.Label>
      </Hero.Checkbox.Content>
    </Hero.Checkbox>
  )
}

export interface RadioGroupProps extends Omit<Hero.RadioGroupProps, 'onChange' | 'className'> {
  onValueChange?: (value: string) => void
  className?: string
}
export function RadioGroup({
  onValueChange,
  className,
  ...props
}: RadioGroupProps): React.JSX.Element {
  return (
    <Hero.RadioGroup
      {...props}
      onChange={onValueChange}
      aria-label={props['aria-label'] ?? '布局'}
      className={cn('ui-radio-group', className)}
    />
  )
}
export function Radio({
  children,
  className,
  ...props
}: Omit<Hero.RadioProps, 'children' | 'className'> & {
  children?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Hero.Radio {...props} className={cn('ui-radio', className)}>
      <Hero.Radio.Content>
        <Hero.Radio.Control>
          <Hero.Radio.Indicator />
        </Hero.Radio.Control>
        <Hero.Label>{children}</Hero.Label>
      </Hero.Radio.Content>
    </Hero.Radio>
  )
}
