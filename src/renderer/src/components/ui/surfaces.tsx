import React, { createContext, forwardRef, useContext, useId, useState } from 'react'
import * as Hero from '@heroui/react'
import { usePress } from 'react-aria'
import { Focusable } from 'react-aria-components'
import { cn, colorStyle, type Appearance, type Classes } from './shared'
import { Button } from './controls'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  as?: 'div'
  isPressable?: boolean
  disableRipple?: boolean
  fullWidth?: boolean
  onPress?: Parameters<typeof usePress>[0]['onPress']
  shadow?: 'none' | 'sm' | 'md' | 'lg'
  radius?: Appearance['radius']
}
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    as: _as,
    isPressable,
    disableRipple: _disableRipple,
    fullWidth,
    onPress,
    className,
    shadow = 'md',
    radius = 'lg',
    onClick,
    ...props
  },
  ref
) {
  const { pressProps, isPressed } = usePress({ isDisabled: !isPressable, onPress })
  return (
    <Hero.Card
      {...props}
      {...(isPressable ? pressProps : {})}
      ref={ref}
      onClick={(event) => {
        pressProps.onClick?.(event)
        onClick?.(event)
      }}
      role={isPressable ? 'button' : props.role}
      tabIndex={isPressable ? 0 : props.tabIndex}
      data-pressed={isPressed || undefined}
      data-ui-radius={radius}
      className={cn(
        'ui-card',
        shadow !== 'none' && (shadow === 'sm' ? 'shadow-small' : 'shadow-medium'),
        fullWidth && 'w-full',
        isPressable && 'cursor-pointer',
        className
      )}
    />
  )
})
export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <Hero.Card.Content {...props} className={cn('ui-card-body', className)} />
}
export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <Hero.Card.Header {...props} className={cn('ui-card-header', className)} />
}
export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <Hero.Card.Footer {...props} className={cn('ui-card-footer', className)} />
}

export function Chip({
  color = 'default',
  size = 'md',
  radius = 'full',
  variant = 'solid',
  className,
  classNames = {},
  startContent,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> &
  Appearance & {
    variant?: 'solid' | 'flat' | 'bordered' | 'dot'
    classNames?: Classes
    startContent?: React.ReactNode
  }): React.JSX.Element {
  return (
    <Hero.Chip
      {...props}
      size={size}
      data-ui-color={color}
      data-ui-size={size}
      data-ui-radius={radius}
      data-ui-variant={variant}
      className={cn('ui-chip', classNames.base, className)}
      style={colorStyle(color)}
    >
      {variant === 'dot' && <span className="ui-chip-dot" />}
      {startContent}
      <span className={cn('ui-chip-content', classNames.content)}>{children}</span>
    </Hero.Chip>
  )
}
export function Badge({
  children,
  content,
  className,
  color = 'default',
  size = 'md',
  showOutline = true,
  shape: _shape,
  variant = 'solid'
}: Appearance & {
  children?: React.ReactNode
  content?: React.ReactNode
  showOutline?: boolean
  shape?: 'circle' | 'rectangle'
  variant?: 'solid' | 'flat'
}): React.JSX.Element {
  return (
    <span className="relative inline-flex shrink-0">
      <Hero.Badge.Anchor>
        {children}
        <Hero.Badge
          color={
            color === 'primary'
              ? 'accent'
              : color === 'default' || color === 'secondary'
                ? 'default'
                : color
          }
          size={size}
          className={cn('ui-badge', className)}
          data-ui-variant={variant}
          data-ui-color={color}
          data-ui-outline={showOutline || undefined}
          style={colorStyle(color)}
        >
          {content}
        </Hero.Badge>
      </Hero.Badge.Anchor>
    </span>
  )
}
export function Avatar({
  src,
  size = 'md',
  radius = 'full',
  className
}: Appearance & { src?: string }): React.JSX.Element {
  return (
    <Hero.Avatar size={size} className={cn('ui-avatar', className)} data-ui-radius={radius}>
      <Hero.Avatar.Image src={src} />
      <Hero.Avatar.Fallback>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4/5 w-4/5">
          <circle cx="12" cy="7" r="5" />
          <ellipse cx="12" cy="18" rx="7" ry="5" />
        </svg>
      </Hero.Avatar.Fallback>
    </Hero.Avatar>
  )
}
export function Divider({
  className,
  ...props
}: Omit<Hero.SeparatorProps, 'className'> & { className?: string }): React.JSX.Element {
  return <Hero.Separator {...props} className={cn('ui-divider', className)} />
}
export const ScrollShadow = Hero.ScrollShadow
export const Spinner = Hero.Spinner

export function Progress({
  value = 0,
  classNames = {},
  className,
  'aria-label': label = '进度'
}: {
  value?: number
  className?: string
  classNames?: Classes
  'aria-label'?: string
}): React.JSX.Element {
  return (
    <Hero.ProgressBar
      aria-label={label}
      value={Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0}
      className={cn('ui-progress', className)}
    >
      <Hero.ProgressBar.Track>
        <Hero.ProgressBar.Fill className={classNames.indicator} />
      </Hero.ProgressBar.Track>
    </Hero.ProgressBar>
  )
}

interface ModalProps {
  children: React.ReactNode
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full'
  scrollBehavior?: 'inside' | 'outside' | 'normal'
  backdrop?: 'transparent' | 'opaque' | 'blur'
  hideCloseButton?: boolean
  disableAnimation?: boolean
  classNames?: Classes
}
const ModalContext = createContext<{
  classNames: Classes
  hideCloseButton?: boolean
  headingId: string
}>({ classNames: {}, headingId: '' })
export function Modal({
  children,
  isOpen,
  onOpenChange,
  size = 'md',
  scrollBehavior = 'normal',
  backdrop = 'opaque',
  hideCloseButton,
  disableAnimation,
  classNames = {}
}: ModalProps): React.JSX.Element {
  const headingId = useId()
  return (
    <ModalContext.Provider value={{ classNames, hideCloseButton, headingId }}>
      <Hero.Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        variant={backdrop === 'blur' ? 'blur' : 'opaque'}
        data-ui-backdrop={backdrop}
        data-ui-no-animation={disableAnimation || undefined}
        className="ui-modal-backdrop"
      >
        <div aria-hidden="true" className={cn('ui-modal-scrim', classNames.backdrop)} />
        <Hero.Modal.Container
          data-ui-size={size}
          scroll={scrollBehavior === 'inside' ? 'inside' : 'outside'}
          className={cn('ui-modal-container', classNames.wrapper)}
        >
          {children}
        </Hero.Modal.Container>
      </Hero.Modal.Backdrop>
    </ModalContext.Provider>
  )
}
export function ModalContent({
  children,
  className
}: {
  children?: React.ReactNode
  className?: string
}): React.JSX.Element {
  const { classNames, hideCloseButton, headingId } = useContext(ModalContext)
  return (
    <Hero.Modal.Dialog
      aria-labelledby={headingId}
      className={cn('ui-modal-dialog', classNames.base, className)}
    >
      {children}
      {!hideCloseButton && <Hero.Modal.CloseTrigger className="ui-modal-close app-nodrag" />}
    </Hero.Modal.Dialog>
  )
}
export function ModalHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  const { classNames, headingId } = useContext(ModalContext)
  return (
    <Hero.Modal.Header {...props} className={cn('ui-modal-header', classNames.header, className)}>
      <Hero.Modal.Heading id={headingId} className="ui-modal-heading">
        {children}
      </Hero.Modal.Heading>
    </Hero.Modal.Header>
  )
}
export function ModalBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <Hero.Modal.Body
      {...props}
      className={cn('ui-modal-body', useContext(ModalContext).classNames.body, className)}
    />
  )
}
export function ModalFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <Hero.Modal.Footer
      {...props}
      className={cn('ui-modal-footer', useContext(ModalContext).classNames.footer, className)}
    />
  )
}

export function Tooltip({
  children,
  content,
  placement,
  isOpen,
  delay = 500,
  showArrow,
  color,
  offset
}: {
  children: React.ReactNode
  content: React.ReactNode
  placement?: Hero.TooltipContentProps['placement']
  isOpen?: boolean
  delay?: number
  showArrow?: boolean
  color?: Appearance['color']
  offset?: number
}): React.JSX.Element {
  return (
    <Hero.Tooltip isOpen={isOpen} delay={delay}>
      {React.isValidElement(children) &&
      children.type !== Button &&
      children.type !== Hero.Button ? (
        <Focusable>{children as React.ComponentProps<typeof Focusable>['children']}</Focusable>
      ) : (
        children
      )}
      <Hero.Tooltip.Content
        placement={placement}
        offset={offset}
        showArrow={showArrow}
        className={cn('ui-tooltip', color === 'danger' && 'bg-danger text-danger-foreground')}
      >
        {showArrow && <Hero.Tooltip.Arrow />}
        {content}
      </Hero.Tooltip.Content>
    </Hero.Tooltip>
  )
}

export function Snippet({
  children,
  symbol = '$',
  size = 'md'
}: {
  children?: React.ReactNode
  symbol?: string
  size?: Appearance['size']
}): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <div className="ui-snippet">
      <code>
        {symbol}
        {children}
      </code>
      <Button
        size={size}
        isIconOnly
        variant="light"
        aria-label="复制"
        onPress={async () => {
          await navigator.clipboard.writeText(String(children ?? ''))
          setCopied(true)
        }}
      >
        {copied ? '✓' : '⧉'}
      </Button>
    </div>
  )
}

export function Pagination({
  total,
  page,
  onChange,
  size = 'md',
  color = 'primary',
  showControls,
  'aria-label': label
}: Appearance & {
  total: number
  page: number
  onChange: (page: number) => void
  variant?: 'flat'
  showControls?: boolean
  disableAnimation?: boolean
  'aria-label'?: string
}): React.JSX.Element {
  const pages = Array.from({ length: total }, (_, index) => index + 1).filter(
    (index) => index === 1 || index === total || Math.abs(index - page) <= 1
  )
  return (
    <Hero.Pagination
      aria-label={label}
      size={size}
      className="ui-pagination"
      style={colorStyle(color)}
    >
      <Hero.Pagination.Content>
        {showControls && (
          <Hero.Pagination.Item>
            <Hero.Pagination.Previous
              aria-label="上一页"
              isDisabled={page <= 1}
              onPress={() => onChange(page - 1)}
            >
              <Hero.Pagination.PreviousIcon />
            </Hero.Pagination.Previous>
          </Hero.Pagination.Item>
        )}
        {pages.flatMap((index, position) => [
          position > 0 && index - pages[position - 1] > 1 ? (
            <Hero.Pagination.Item key={`gap-${index}`}>
              <Hero.Pagination.Ellipsis />
            </Hero.Pagination.Item>
          ) : null,
          <Hero.Pagination.Item key={index}>
            <Hero.Pagination.Link isActive={index === page} onPress={() => onChange(index)}>
              {index}
            </Hero.Pagination.Link>
          </Hero.Pagination.Item>
        ])}
        {showControls && (
          <Hero.Pagination.Item>
            <Hero.Pagination.Next
              aria-label="下一页"
              isDisabled={page >= total}
              onPress={() => onChange(page + 1)}
            >
              <Hero.Pagination.NextIcon />
            </Hero.Pagination.Next>
          </Hero.Pagination.Item>
        )}
      </Hero.Pagination.Content>
    </Hero.Pagination>
  )
}
