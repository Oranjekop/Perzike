import React, {
  Children,
  createContext,
  forwardRef,
  Fragment,
  isValidElement,
  useContext,
  useState
} from 'react'
import * as V3 from '@heroui/react'

type Key = string | number
type ClassNames = Record<string, string | undefined>
// The adapter intentionally accepts the v2 prop surface while translating it to typed v3 components.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseProps = Record<string, any>

export const cn = V3.cn

const flattenChildren = (children: React.ReactNode): React.ReactElement[] => {
  const result: React.ReactElement[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    if (child.type === Fragment) {
      result.push(...flattenChildren((child.props as { children?: React.ReactNode }).children))
      return
    }
    result.push(child)
  })
  return result
}

const keyedChildren = (
  children: React.ReactNode,
  marker: React.ElementType
): React.ReactElement[] => flattenChildren(children).filter((child) => child.type === marker)

export const HeroUIProvider: React.FC<React.PropsWithChildren> = ({ children }) => <>{children}</>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buttonVariant = (color?: string, variant?: string): any => {
  if (color === 'danger') return variant === 'solid' ? 'danger' : 'danger-soft'
  if (color === 'success' || color === 'warning') return 'primary'
  if (variant === 'light') return 'ghost'
  if (variant === 'bordered' || variant === 'ghost') return 'outline'
  if (variant === 'flat') return 'secondary'
  if (color === 'primary' || color === 'secondary') return 'primary'
  return 'secondary'
}

const mapButtonProps = (props: LooseProps): LooseProps => {
  const {
    color,
    variant,
    isLoading,
    isPending,
    disabled,
    startContent,
    children,
    className,
    fullWidth,
    isIconOnly,
    radius,
    size = 'md',
    onClick,
    onPress,
    ...rest
  } = props
  return {
    ...rest,
    variant: buttonVariant(color, variant),
    isPending: isLoading || isPending,
    isDisabled: disabled || props.isDisabled,
    className: cn(
      'legacy-button',
      `legacy-button--${size}`,
      `legacy-button--${variant ?? 'solid'}`,
      `legacy-button--color-${color ?? 'default'}`,
      isIconOnly && 'legacy-button--icon-only',
      fullWidth && 'w-full',
      radius && `legacy-radius--${radius}`,
      variant === 'shadow' && 'shadow-medium',
      className
    ),
    fullWidth,
    isIconOnly,
    size,
    onPress: onPress ?? onClick,
    children: (
      <>
        {startContent}
        {children}
      </>
    )
  }
}

export const Button = forwardRef<HTMLButtonElement, LooseProps>((props, ref) => (
  <V3.Button ref={ref} {...mapButtonProps(props)} />
))
Button.displayName = 'Button'

export const Divider: React.FC<LooseProps> = ({ orientation = 'horizontal', ...props }) => (
  <V3.Separator orientation={orientation} {...props} />
)

export const ScrollShadow = V3.ScrollShadow
export const Spinner: React.FC<LooseProps> = ({ color, ...props }) => (
  <V3.Spinner color={color === 'primary' ? 'accent' : color} {...props} />
)

export const Card = forwardRef<HTMLDivElement, LooseProps>(
  (
    { as: _as, fullWidth, isPressable, onPress, onClick, radius, shadow, className, ...props },
    ref
  ) => (
    <V3.Card
      ref={ref}
      {...props}
      role={isPressable ? 'button' : props.role}
      tabIndex={isPressable ? 0 : props.tabIndex}
      className={cn(
        'legacy-card',
        fullWidth && 'w-full',
        isPressable && 'cursor-pointer',
        radius === 'sm' && 'rounded-lg',
        radius === 'lg' && 'rounded-2xl',
        shadow === 'none' && 'shadow-none',
        className
      )}
      onClick={onPress ?? onClick}
      onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
        props.onKeyDown?.(event)
        if (isPressable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          ;(onPress ?? onClick)?.(event)
        }
      }}
    />
  )
)
Card.displayName = 'Card'

export const CardBody: React.FC<LooseProps> = ({ className, ...props }) => (
  <V3.Card.Content
    {...props}
    className={cn(
      'legacy-card-body relative flex flex-auto flex-1 flex-col w-full h-auto p-3 break-words text-left overflow-y-auto',
      className
    )}
  />
)

export const CardHeader: React.FC<LooseProps> = ({ className, ...props }) => (
  <V3.Card.Header
    {...props}
    className={cn(
      'legacy-card-header flex w-full shrink-0 items-center justify-start overflow-inherit p-3',
      className
    )}
  />
)

export const CardFooter: React.FC<LooseProps> = ({ className, ...props }) => (
  <V3.Card.Footer
    {...props}
    className={cn('legacy-card-footer flex h-auto w-full items-center overflow-hidden p-3', className)}
  />
)

export const Chip: React.FC<LooseProps> = ({
  color = 'default',
  variant,
  radius,
  size = 'md',
  startContent,
  className,
  classNames,
  children,
  ...props
}) => (
  <V3.Chip
    {...props}
    color={color === 'primary' || color === 'secondary' ? 'accent' : color}
    variant={
      variant == null || variant === 'solid'
        ? 'primary'
        : variant === 'flat'
          ? 'soft'
          : 'tertiary'
    }
    className={cn(
      'legacy-chip',
      `legacy-chip--${size}`,
      `legacy-chip--${variant ?? 'solid'}`,
      `legacy-chip--color-${color}`,
      `legacy-radius--${radius ?? 'full'}`,
      variant === 'bordered' && 'border border-divider',
      variant === 'dot' &&
        'border border-divider before:size-1.5 before:rounded-full before:bg-current',
      radius === 'sm' && 'rounded-md',
      classNames?.base,
      className
    )}
  >
    {startContent}
    <V3.Chip.Label className={cn('legacy-chip-label', classNames?.content)}>{children}</V3.Chip.Label>
  </V3.Chip>
)

export const Avatar: React.FC<LooseProps> = ({ src, className, radius, ...props }) => (
  <V3.Avatar
    {...props}
    className={cn(radius === 'sm' && 'rounded-md', radius === 'full' && 'rounded-full', className)}
  >
    <V3.Avatar.Image src={src} />
    <V3.Avatar.Fallback />
  </V3.Avatar>
)

export const Badge: React.FC<LooseProps> = ({
  content,
  children,
  color,
  variant,
  size = 'md',
  shape = 'rectangle',
  showOutline,
  className,
  ...props
}) => (
  <V3.Badge
    {...props}
    color={color === 'primary' || color === 'secondary' ? 'accent' : color}
    variant={variant === 'flat' ? 'soft' : 'primary'}
    className={cn('legacy-badge', className)}
  >
    <V3.Badge.Anchor>{children}</V3.Badge.Anchor>
    <V3.Badge.Label
      className={cn(
        'legacy-badge-label',
        `legacy-badge-label--${size}`,
        `legacy-badge-label--${shape}`,
        showOutline === false && 'ring-0'
      )}
    >
      {content}
    </V3.Badge.Label>
  </V3.Badge>
)

export const Progress: React.FC<LooseProps> = ({
  value,
  className,
  classNames,
  size = 'md',
  radius = 'full'
}) => (
  <V3.ProgressBar value={value} className={cn('legacy-progress', classNames?.base, className)}>
    <V3.ProgressBar.Track
      className={cn(
        'legacy-progress-track',
        `legacy-progress-track--${size}`,
        `legacy-radius--${radius}`,
        classNames?.track
      )}
    >
      <V3.ProgressBar.Fill
        className={cn('legacy-progress-fill', `legacy-radius--${radius}`, classNames?.indicator)}
      />
    </V3.ProgressBar.Track>
  </V3.ProgressBar>
)

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  classNames?: ClassNames
  endContent?: React.ReactNode
  fullWidth?: boolean
  isClearable?: boolean
  isDisabled?: boolean
  onClear?: () => void
  onValueChange?: (value: string) => void
  size?: 'sm' | 'md' | 'lg'
  startContent?: React.ReactNode
  variant?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      classNames,
      disabled,
      endContent,
      fullWidth,
      isClearable,
      isDisabled,
      onChange,
      onClear,
      onValueChange,
      size = 'md',
      startContent,
      style,
      variant: _variant,
      ...props
    },
    ref
  ) => {
    const [hovered, setHovered] = useState(false)
    const [focused, setFocused] = useState(false)
    const hasValue = String(props.value ?? '').length > 0
    return (
      <div className={cn('legacy-input', fullWidth && 'w-full', classNames?.base, className)}>
        <div
          data-slot="input-wrapper"
          data-hover={hovered || undefined}
          data-focus={focused || undefined}
          className={cn(
            'legacy-input-wrapper flex w-full items-center gap-2 bg-default-100',
            size === 'sm'
              ? 'h-8 min-h-8 rounded-lg px-2 text-sm'
              : size === 'lg'
                ? 'h-12 min-h-12 rounded-[14px] px-3 text-base'
                : 'h-10 min-h-10 rounded-xl px-3 text-sm',
            classNames?.mainWrapper,
            classNames?.inputWrapper
          )}
          style={style}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {startContent}
          <V3.Input
            {...props}
            ref={ref}
            disabled={disabled || isDisabled}
            className={cn('legacy-input-field min-w-0 flex-1', classNames?.input)}
            onFocus={(event) => {
              setFocused(true)
              props.onFocus?.(event)
            }}
            onBlur={(event) => {
              setFocused(false)
              props.onBlur?.(event)
            }}
            onChange={(event) => {
              onChange?.(event)
              onValueChange?.(event.target.value)
            }}
          />
          {isClearable && hasValue && (
            <button
              type="button"
              aria-label="清空"
              className={cn('text-foreground-500 hover:text-foreground', classNames?.clearButton)}
              onClick={() => {
                onClear?.()
                onValueChange?.('')
              }}
            >
              ×
            </button>
          )}
          {endContent}
        </div>
      </div>
    )
  }
)
Input.displayName = 'Input'

export type SwitchProps = LooseProps & {
  isDisabled?: boolean
  isSelected?: boolean
  onValueChange?: (selected: boolean) => void
}

export const Switch: React.FC<SwitchProps> = ({
  children,
  className,
  classNames,
  isSelected,
  onChange,
  onValueChange,
  size = 'md',
  ...props
}) => (
  <V3.Switch
    {...props}
    isSelected={isSelected}
    onChange={onValueChange ?? onChange}
    className={cn('legacy-switch', `legacy-switch--${size}`, classNames?.base, className)}
  >
    {children && <V3.Switch.Content className={classNames?.label}>{children}</V3.Switch.Content>}
    <V3.Switch.Control className={cn('legacy-switch-control', classNames?.wrapper)}>
      <V3.Switch.Thumb className={cn('legacy-switch-thumb', classNames?.thumb)} />
    </V3.Switch.Control>
  </V3.Switch>
)

export const RadioGroup: React.FC<LooseProps> = ({
  orientation,
  className,
  onChange,
  onValueChange,
  ...props
}) => (
  <V3.RadioGroup
    {...props}
    onChange={onValueChange ?? onChange}
    className={cn('legacy-radio-group', orientation === 'horizontal' && 'flex-row', className)}
  />
)

export const Radio: React.FC<LooseProps> = ({ children, size = 'md', ...props }) => (
  <V3.Radio {...props} value={props.value} className={cn('legacy-radio', props.className)}>
    <V3.Radio.Control className={cn('legacy-radio-control', `legacy-radio-control--${size}`)}>
      <V3.Radio.Indicator
        className={cn('legacy-radio-indicator', `legacy-radio-indicator--${size}`)}
      />
    </V3.Radio.Control>
    <V3.Radio.Content className={cn('legacy-radio-content', `legacy-radio-content--${size}`)}>
      {children}
    </V3.Radio.Content>
  </V3.Radio>
)

export const Tab: React.FC<LooseProps> = () => null

export const Tabs: React.FC<LooseProps> = ({
  children,
  className,
  classNames,
  color = 'default',
  fullWidth,
  radius,
  selectedKey,
  size = 'md',
  variant,
  ...props
}) => {
  const items = keyedChildren(children, Tab)
  return (
    <V3.Tabs
      {...props}
      selectedKey={selectedKey}
      variant={variant === 'underlined' ? 'secondary' : 'primary'}
      className={cn(
        'legacy-tabs',
        `legacy-tabs--${size}`,
        `legacy-tabs--${variant ?? 'solid'}`,
        `legacy-tabs--color-${color}`,
        radius && `legacy-tabs--radius-${radius}`,
        fullWidth && 'w-full',
        classNames?.base,
        className
      )}
    >
      <V3.Tabs.ListContainer>
        <V3.Tabs.List
          className={cn('legacy-tabs-list', fullWidth && 'w-full', classNames?.tabList)}
        >
          {items.map((item, index) => {
            const itemProps = item.props as LooseProps
            return (
              <V3.Tabs.Tab
                id={(item.key ?? index) as Key}
                key={item.key ?? index}
                className={cn('legacy-tabs-tab', classNames?.tab, itemProps.className)}
              >
                <span className={cn('legacy-tabs-content', classNames?.tabContent)}>
                  {itemProps.title}
                </span>
                <V3.Tabs.Indicator
                  className={cn('legacy-tabs-indicator', classNames?.cursor)}
                />
              </V3.Tabs.Tab>
            )
          })}
        </V3.Tabs.List>
      </V3.Tabs.ListContainer>
      {items.map((item, index) => {
        const itemProps = item.props as LooseProps
        return itemProps.children ? (
          <V3.Tabs.Panel
            id={(item.key ?? index) as Key}
            key={item.key ?? index}
            className={classNames?.panel}
          >
            {itemProps.children}
          </V3.Tabs.Panel>
        ) : null
      })}
    </V3.Tabs>
  )
}

export const SelectItem: React.FC<LooseProps> = () => null

const makeSelection = (value: Key | Key[] | null): Set<Key> & { currentKey?: Key } => {
  const values = value == null ? [] : Array.isArray(value) ? value : [value]
  const selection = new Set(values) as Set<Key> & { currentKey?: Key }
  selection.currentKey = values.at(-1)
  return selection
}

export const Select: React.FC<LooseProps> = ({
  children,
  className,
  classNames,
  disallowEmptySelection,
  onChange,
  onSelectionChange,
  selectedKeys,
  selectionMode = 'single',
  size = 'md',
  ...props
}) => {
  const items = keyedChildren(children, SelectItem)
  const selected =
    selectedKeys === 'all' ? items.map((item) => item.key as Key) : [...(selectedKeys ?? [])]
  const value = selectionMode === 'multiple' ? selected : (selected[0] ?? null)
  return (
    <V3.Select
      {...props}
      className={cn('w-full', classNames?.base, className)}
      value={value}
      selectionMode={selectionMode}
      onChange={(nextValue: Key | Key[] | null) => {
        const selection = makeSelection(nextValue)
        onSelectionChange?.(selection)
        onChange?.({ target: { value: selection.currentKey ?? '' } })
      }}
    >
      <V3.Select.Trigger
        className={cn(
          'app-select-trigger',
          size === 'sm'
            ? 'h-8 min-h-8 rounded-lg px-2 text-sm'
            : size === 'lg'
              ? 'h-12 min-h-12 rounded-[14px] px-3 text-base'
              : 'h-10 min-h-10 rounded-xl px-3 text-sm',
          classNames?.trigger
        )}
      >
        <V3.Select.Value />
        <V3.Select.Indicator />
      </V3.Select.Trigger>
      <V3.Select.Popover
        className={cn('app-select-popover rounded-lg', classNames?.popoverContent)}
      >
        <V3.ListBox className={cn('rounded-lg p-1 text-sm', classNames?.listbox)}>
          {items.map((item, index) => {
            const itemProps = item.props as LooseProps
            const id = (item.key ?? index) as Key
            return (
              <V3.ListBox.Item
                id={id}
                key={id}
                textValue={itemProps.textValue ?? String(itemProps.children ?? id)}
                className={cn(
                  'legacy-listbox-item min-h-8 rounded-md px-2.5 py-1.5 text-sm',
                  itemProps.className
                )}
              >
                {itemProps.children}
                <V3.ListBox.ItemIndicator />
              </V3.ListBox.Item>
            )
          })}
        </V3.ListBox>
      </V3.Select.Popover>
    </V3.Select>
  )
}

export const Tooltip: React.FC<LooseProps> = ({
  children,
  color,
  content,
  showArrow,
  ...props
}) => (
  <V3.Tooltip {...props}>
    <V3.Tooltip.Trigger>{children}</V3.Tooltip.Trigger>
    <V3.Tooltip.Content
      showArrow={showArrow}
      className={cn(color === 'danger' && 'bg-danger text-danger-foreground')}
    >
      {content}
      {showArrow && <V3.Tooltip.Arrow />}
    </V3.Tooltip.Content>
  </V3.Tooltip>
)

export const DropdownItem: React.FC<LooseProps> = () => null
export const Dropdown: React.FC<LooseProps> = ({ children, ...props }) => (
  <V3.Dropdown {...props}>{children}</V3.Dropdown>
)

export const DropdownTrigger: React.FC<LooseProps> = ({ children }) => {
  const child = Children.only(children) as React.ReactElement<LooseProps>
  const mapped = mapButtonProps(child.props)
  const { fullWidth: _fullWidth, isIconOnly: _isIconOnly, size: _size, ...triggerProps } = mapped
  return (
    <V3.Dropdown.Trigger
      {...triggerProps}
      className={mapped.className}
    />
  )
}

export const DropdownMenu: React.FC<LooseProps> = ({
  children,
  className,
  emptyContent,
  ...props
}) => {
  const items = keyedChildren(children, DropdownItem)
  return (
    <V3.Dropdown.Popover className="app-select-popover rounded-lg">
      <V3.Dropdown.Menu {...props} className={className}>
        {items.length ? (
          items.map((item, index) => {
            const itemProps = item.props as LooseProps
            const id = (item.key ?? index) as Key
            const { color, showDivider, startContent, children: label, ...rest } = itemProps
            return (
              <V3.Dropdown.Item
                {...rest}
                id={id}
                key={id}
                className={cn(
                  'legacy-dropdown-item min-h-8 rounded-md px-2.5 py-1.5 text-sm',
                  color === 'danger' && 'text-danger',
                  showDivider && 'border-b border-divider'
                )}
              >
                {startContent}
                {label}
              </V3.Dropdown.Item>
            )
          })
        ) : (
          <V3.Dropdown.Item id="empty" isDisabled>
            {emptyContent}
          </V3.Dropdown.Item>
        )}
      </V3.Dropdown.Menu>
    </V3.Dropdown.Popover>
  )
}

export const AccordionItem: React.FC<LooseProps> = () => null

export const Accordion: React.FC<LooseProps> = ({
  children,
  className,
  defaultExpandedKeys,
  itemClasses,
  isCompact,
  selectionMode,
  variant,
  ...props
}) => {
  const items = keyedChildren(children, AccordionItem)
  return (
    <V3.Accordion
      {...props}
      className={cn(
        'legacy-accordion',
        `legacy-accordion--${variant ?? 'light'}`,
        isCompact && 'legacy-accordion--compact',
        className
      )}
      variant={variant === 'splitted' ? 'surface' : 'default'}
      defaultExpandedKeys={defaultExpandedKeys}
      allowsMultipleExpanded={selectionMode === 'multiple'}
    >
      {items.map((item, index) => {
        const itemProps = item.props as LooseProps
        const id = (item.key ?? index) as Key
        return (
          <V3.Accordion.Item
            id={id}
            key={id}
            className={cn('legacy-accordion-item', itemClasses?.base, itemProps.className)}
          >
            <V3.Accordion.Heading>
              <V3.Accordion.Trigger
                className={cn('legacy-accordion-trigger', itemClasses?.trigger)}
              >
                {(state: LooseProps) => (
                  <>
                    <span className={cn('legacy-accordion-title', itemClasses?.title)}>
                      {itemProps.title}
                    </span>
                    {typeof itemProps.indicator === 'function' ? (
                      itemProps.indicator({ isOpen: state.isExpanded })
                    ) : (
                      <V3.Accordion.Indicator>{itemProps.indicator}</V3.Accordion.Indicator>
                    )}
                  </>
                )}
              </V3.Accordion.Trigger>
            </V3.Accordion.Heading>
            <V3.Accordion.Panel className="legacy-accordion-panel">
              <V3.Accordion.Body
                className={cn('legacy-accordion-content', itemClasses?.content)}
              >
                {itemProps.children}
              </V3.Accordion.Body>
            </V3.Accordion.Panel>
          </V3.Accordion.Item>
        )
      })}
    </V3.Accordion>
  )
}

type ModalContextValue = LooseProps & { close: () => void }
const ModalContext = createContext<ModalContextValue | null>(null)

export const Modal: React.FC<LooseProps> = ({ children, onOpenChange, ...props }) => (
  <ModalContext value={{ ...props, onOpenChange, close: () => onOpenChange?.(false) }}>
    <V3.Modal isOpen={props.isOpen} onOpenChange={onOpenChange}>
      {children}
    </V3.Modal>
  </ModalContext>
)

export const ModalContent: React.FC<LooseProps> = ({ children, className }) => {
  const context = useContext(ModalContext)
  if (!context) return null
  const content = typeof children === 'function' ? children(context.close) : children
  return (
    <V3.Modal.Backdrop
      variant={
        context.backdrop === 'transparent'
          ? 'transparent'
          : context.backdrop === 'blur'
            ? 'blur'
            : 'opaque'
      }
      className={context.classNames?.backdrop}
    >
      <V3.Modal.Container
        size={
          ['xs', 'sm', 'md', 'lg', 'full'].includes(context.size ?? 'md')
            ? (context.size ?? 'md')
            : 'lg'
        }
        scroll={context.scrollBehavior}
        className={cn(
          'legacy-modal-container',
          ['xl', '2xl', '3xl', '4xl', '5xl'].includes(context.size) &&
            'legacy-modal-container--wide',
          context.classNames?.wrapper
        )}
      >
        <V3.Modal.Dialog
          className={cn(
            'legacy-modal-dialog',
            context.size === '5xl' && 'max-w-5xl',
            context.size === '4xl' && 'max-w-4xl',
            context.size === '3xl' && 'max-w-3xl',
            context.size === '2xl' && 'max-w-2xl',
            context.size === 'xl' && 'max-w-xl',
            context.classNames?.base,
            className
          )}
        >
          {content}
          {!context.hideCloseButton && <V3.Modal.CloseTrigger />}
        </V3.Modal.Dialog>
      </V3.Modal.Container>
    </V3.Modal.Backdrop>
  )
}

export const ModalHeader: React.FC<LooseProps> = ({ children, className, ...props }) => (
  <V3.Modal.Header {...props} className={cn('legacy-modal-header', className)}>
    <V3.Modal.Heading>{children}</V3.Modal.Heading>
  </V3.Modal.Header>
)
export const ModalBody: React.FC<LooseProps> = ({ className, ...props }) => (
  <V3.Modal.Body {...props} className={cn('legacy-modal-body', className)} />
)
export const ModalFooter: React.FC<LooseProps> = ({ className, ...props }) => (
  <V3.Modal.Footer {...props} className={cn('legacy-modal-footer', className)} />
)

export const Checkbox: React.FC<LooseProps> = ({
  checked,
  children,
  isSelected,
  onValueChange,
  size = 'md',
  ...props
}) => (
  <V3.Checkbox
    {...props}
    isSelected={isSelected ?? checked}
    onChange={onValueChange}
    className={cn('legacy-checkbox', props.className)}
  >
    <V3.Checkbox.Control className={cn('legacy-checkbox-control', `legacy-checkbox--${size}`)}>
      <V3.Checkbox.Indicator className="legacy-checkbox-indicator" />
    </V3.Checkbox.Control>
    <V3.Checkbox.Content>{children}</V3.Checkbox.Content>
  </V3.Checkbox>
)

export const Snippet: React.FC<LooseProps> = ({ children, className }) => (
  <button
    type="button"
    className={cn('rounded-lg bg-default px-2 py-1 font-mono text-xs', className)}
    onClick={() => navigator.clipboard.writeText(String(children))}
  >
    {children}
  </button>
)
