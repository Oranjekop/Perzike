import React from 'react'
import * as Hero from '@heroui/react'
import { cn, colorStyle, elements, type Appearance, type Classes } from './shared'

type Selection = Set<React.Key> & { currentKey?: React.Key }
interface ItemProps {
  children?: React.ReactNode
  title?: React.ReactNode
  className?: string
  isDisabled?: boolean
  textValue?: string
}
// Declarative item descriptors are expanded into v3 compound components by their parent.
export function SelectItem(_props: ItemProps): React.JSX.Element {
  return <></>
}
export interface SelectProps extends Appearance {
  children: React.ReactNode
  classNames?: Classes
  selectedKeys?: Iterable<React.Key>
  defaultSelectedKeys?: Iterable<React.Key>
  selectionMode?: 'single' | 'multiple'
  onSelectionChange?: (keys: Selection) => void
  disallowEmptySelection?: boolean
  isDisabled?: boolean
  'aria-label'?: string
}
export function Select({
  children,
  size = 'md',
  className,
  classNames = {},
  selectedKeys,
  defaultSelectedKeys,
  selectionMode = 'single',
  onSelectionChange,
  disallowEmptySelection,
  isDisabled,
  'aria-label': label = '选择',
  ...appearance
}: SelectProps): React.JSX.Element {
  const items = elements<ItemProps>(children)
  const keys =
    selectedKeys && [...selectedKeys].map((key) => (typeof key === 'bigint' ? String(key) : key))
  const defaults =
    defaultSelectedKeys &&
    [...defaultSelectedKeys].map((key) => (typeof key === 'bigint' ? String(key) : key))
  const multiple = selectionMode === 'multiple'
  const change = (value: string | number | readonly (string | number)[] | null): void => {
    const values: (string | number)[] =
      value === null
        ? []
        : typeof value === 'string' || typeof value === 'number'
          ? [value]
          : [...value]
    if (disallowEmptySelection && !values.length) return
    const result: Selection = new Set(values)
    result.currentKey = values.find((key) => !keys?.includes(key)) ?? values[values.length - 1]
    onSelectionChange?.(result)
  }
  const content = (
    <>
      <Hero.Select.Trigger
        data-slot="trigger"
        data-ui-size={size}
        className={cn('ui-select-trigger bg-default-100', classNames.trigger)}
      >
        <Hero.Select.Value className="ui-select-value" />
        <Hero.Select.Indicator />
      </Hero.Select.Trigger>
      <Hero.Select.Popover data-slot="content" className="ui-popover ui-select-popover">
        <Hero.ListBox className="ui-list-box">
          {items.map((item, index) => (
            <Hero.ListBox.Item
              key={item.key ?? index}
              id={item.key ?? index}
              isDisabled={item.props.isDisabled}
              textValue={
                item.props.textValue ??
                (typeof item.props.children === 'string' ? item.props.children : undefined)
              }
              className={cn('ui-list-item', item.props.className)}
            >
              <Hero.Label>{item.props.children}</Hero.Label>
              <Hero.ListBox.ItemIndicator />
            </Hero.ListBox.Item>
          ))}
        </Hero.ListBox>
      </Hero.Select.Popover>
    </>
  )
  const shared = {
    className: cn('ui-select', className),
    'aria-label': label,
    isDisabled,
    style: colorStyle(appearance.color)
  }
  return multiple ? (
    <Hero.Select
      {...shared}
      selectionMode="multiple"
      value={keys}
      defaultValue={defaults}
      onChange={change}
    >
      {content}
    </Hero.Select>
  ) : (
    <Hero.Select
      {...shared}
      value={keys ? (keys[0] ?? null) : undefined}
      defaultValue={defaults?.[0]}
      onChange={change}
    >
      {content}
    </Hero.Select>
  )
}

export function Tab(_props: ItemProps): React.JSX.Element {
  return <></>
}
export interface TabsProps
  extends
    Omit<Hero.TabsProps, 'children' | 'className' | 'variant' | 'onSelectionChange'>,
    Appearance {
  children: React.ReactNode
  classNames?: Classes
  variant?: 'solid' | 'underlined' | 'bordered' | 'light'
  fullWidth?: boolean
  onSelectionChange?: (key: React.Key) => void
}
export function Tabs({
  children,
  size = 'md',
  color = 'default',
  radius,
  variant = 'solid',
  className,
  classNames = {},
  fullWidth,
  ...props
}: TabsProps): React.JSX.Element {
  const items = elements<ItemProps>(children)
  return (
    <Hero.Tabs
      {...props}
      variant={variant === 'underlined' ? 'secondary' : 'primary'}
      data-ui-size={size}
      data-ui-variant={variant}
      data-ui-radius={radius}
      className={cn('ui-tabs', fullWidth && 'w-full', className)}
      style={colorStyle(color)}
    >
      {/* These compact tab lists need overflow for badges and card shadows,
          not v3's additional masked horizontal scroller. */}
      <div className="ui-tabs-container">
        <Hero.Tabs.List
          aria-label={props['aria-label'] ?? '选项'}
          data-slot="tabList"
          className={cn(
            'ui-tabs-list',
            variant === 'solid' && 'bg-default-100',
            classNames.tabList
          )}
        >
          {items.map((item, index) => (
            <Hero.Tabs.Tab
              key={item.key ?? index}
              id={item.key ?? index}
              isDisabled={item.props.isDisabled}
              className={cn('ui-tab group', classNames.tab, item.props.className)}
            >
              <Hero.Tabs.Indicator className={cn('ui-tabs-cursor', classNames.cursor)} />
              <span className={cn('ui-tab-content', classNames.tabContent)}>
                {item.props.title}
              </span>
            </Hero.Tabs.Tab>
          ))}
        </Hero.Tabs.List>
      </div>
      {items
        .filter((item) => item.props.children != null)
        .map((item, index) => (
          <Hero.Tabs.Panel
            key={item.key ?? index}
            id={item.key ?? index}
            className={cn('py-3 px-1', classNames.panel)}
          >
            {item.props.children}
          </Hero.Tabs.Panel>
        ))}
    </Hero.Tabs>
  )
}

interface AccordionItemProps extends ItemProps {
  actions?: React.ReactNode
  keepContentMounted?: boolean
  indicator?: (state: { isOpen: boolean }) => React.ReactNode
  'aria-label'?: string
}
export function AccordionItem(_props: AccordionItemProps): React.JSX.Element {
  return <></>
}
interface AccordionProps extends Omit<Hero.AccordionProps, 'children' | 'className' | 'variant'> {
  children?: React.ReactNode
  className?: string
  variant?: 'splitted' | 'light' | 'bordered' | 'shadow'
  selectionMode?: 'single' | 'multiple'
  isCompact?: boolean
  itemClasses?: Classes
}
export function Accordion({
  children,
  variant,
  selectionMode = 'single',
  isCompact,
  itemClasses = {},
  className,
  ...props
}: AccordionProps): React.JSX.Element {
  return (
    <Hero.Accordion
      {...props}
      allowsMultipleExpanded={selectionMode === 'multiple'}
      hideSeparator={variant === 'splitted'}
      className={cn('ui-accordion', className)}
      data-ui-splitted={variant === 'splitted' || undefined}
      data-ui-compact={isCompact || undefined}
    >
      {elements<AccordionItemProps>(children).map((item, index) => (
        <Hero.Accordion.Item
          key={item.key ?? index}
          id={item.key ?? index}
          isDisabled={item.props.isDisabled}
          className={cn('ui-accordion-item', itemClasses.base, item.props.className)}
        >
          {({ isExpanded }) => (
            <>
              <div className="relative">
                <Hero.Accordion.Heading>
                  <Hero.Accordion.Trigger
                    aria-label={item.props['aria-label']}
                    className={cn('ui-accordion-trigger', itemClasses.trigger)}
                  >
                    <span
                      className={cn(
                        'flex-1 text-left',
                        item.props.actions && 'pr-22',
                        itemClasses.title
                      )}
                    >
                      {item.props.title}
                    </span>
                    {item.props.indicator ? (
                      item.props.indicator({ isOpen: isExpanded })
                    ) : (
                      <Hero.Accordion.Indicator />
                    )}
                  </Hero.Accordion.Trigger>
                </Hero.Accordion.Heading>
                {item.props.actions && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    {item.props.actions}
                  </div>
                )}
              </div>
              <Hero.Accordion.Panel className={cn('ui-accordion-panel', itemClasses.content)}>
                <Hero.Accordion.Body>{item.props.children}</Hero.Accordion.Body>
              </Hero.Accordion.Panel>
            </>
          )}
        </Hero.Accordion.Item>
      ))}
    </Hero.Accordion>
  )
}

interface DropdownItemProps extends ItemProps {
  startContent?: React.ReactNode
  showDivider?: boolean
  color?: Appearance['color']
}
export function DropdownItem(_props: DropdownItemProps): React.JSX.Element {
  return <></>
}
export const Dropdown = Hero.Dropdown
// v3 buttons consume the MenuTrigger context directly; never nest two buttons.
export function DropdownTrigger({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>
}
export function DropdownMenu({
  children,
  className,
  emptyContent,
  ...props
}: Omit<Hero.DropdownMenuProps<object>, 'children' | 'className'> & {
  children: React.ReactNode
  className?: string
  emptyContent?: React.ReactNode
}): React.JSX.Element {
  return (
    <Hero.Dropdown.Popover data-slot="content" className="ui-popover">
      <Hero.Dropdown.Menu
        {...props}
        aria-label={props['aria-label'] ?? '操作菜单'}
        className={cn('ui-list-box', className)}
        renderEmptyState={() => emptyContent ?? '没有可用选项'}
      >
        {elements<DropdownItemProps>(children).map((item, index) => (
          <Hero.Dropdown.Item
            key={item.key ?? index}
            id={item.key ?? index}
            isDisabled={item.props.isDisabled}
            textValue={
              item.props.textValue ??
              (typeof item.props.children === 'string' ? item.props.children : undefined)
            }
            variant={item.props.color === 'danger' ? 'danger' : undefined}
            className={cn(
              'ui-list-item',
              item.props.showDivider && 'ui-menu-divider',
              item.props.className
            )}
          >
            {item.props.startContent}
            <Hero.Label>{item.props.children}</Hero.Label>
          </Hero.Dropdown.Item>
        ))}
      </Hero.Dropdown.Menu>
    </Hero.Dropdown.Popover>
  )
}
