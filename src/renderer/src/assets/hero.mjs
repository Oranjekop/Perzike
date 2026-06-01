import { heroui } from '@heroui/react'

const iconBlue = {
  50: '#eff8ff',
  100: '#d9eeff',
  200: '#bddfff',
  300: '#99ccff',
  400: '#7abaff',
  500: '#69afff',
  600: '#4b98f4',
  700: '#377fdd',
  800: '#2f68b3',
  900: '#2c598d',
  foreground: '#ffffff',
  DEFAULT: '#69afff'
}

export default heroui({
  themes: {
    light: {
      colors: {
        background: '#f7fbff',
        foreground: '#1b2435',
        divider: '#d9e8f7',
        focus: iconBlue[500],
        content1: '#ffffff',
        content2: '#eef6ff',
        content3: '#ddeeff',
        content4: '#cae4ff',
        default: {
          50: '#fafcff',
          100: '#f2f7fc',
          200: '#e6eef7',
          300: '#d5dfec',
          400: '#afbccd',
          500: '#7f8b9d',
          600: '#616b7c',
          700: '#4c5566',
          800: '#31384a',
          900: '#1e2535',
          foreground: '#1b2435',
          DEFAULT: '#eef4fb'
        },
        primary: iconBlue,
        secondary: {
          50: '#f3f7ff',
          100: '#e6eeff',
          200: '#d4e0ff',
          300: '#b9cbff',
          400: '#95adff',
          500: '#738fff',
          600: '#5d72f5',
          700: '#4d5bdf',
          800: '#414cb4',
          900: '#39438d',
          foreground: '#ffffff',
          DEFAULT: '#738fff'
        },
        success: '#4caf78',
        warning: '#f2ad4e',
        danger: '#eb6d73'
      }
    },
    dark: {
      colors: {
        // Neutral graphite dark theme. Keep blue as the accent only,
        // so the UI does not mix gray background, saturated blue cards,
        // and bright blue glow at the same time.
        background: '#0f1115',
        foreground: '#edf2f8',
        divider: '#2a3140',
        focus: '#5d9eff',
        content1: '#1a1f29',
        content2: '#202633',
        content3: '#272f3e',
        content4: '#303848',
        default: {
          50: '#12151b',
          100: '#171b23',
          200: '#1f2530',
          300: '#2a3140',
          400: '#4a5568',
          500: '#7b8798',
          600: '#9aa5b5',
          700: '#bcc6d4',
          800: '#dce4ef',
          900: '#f2f6fb',
          foreground: '#edf2f8',
          DEFAULT: '#1a1f29'
        },
        primary: {
          50: '#10223f',
          100: '#17335e',
          200: '#204a86',
          300: '#2f68b8',
          400: '#4b8fe8',
          500: '#5d9eff',
          600: '#7eb4ff',
          700: '#a6ccff',
          800: '#cfe4ff',
          900: '#ecf6ff',
          foreground: '#08111f',
          DEFAULT: '#5d9eff'
        },
        secondary: {
          50: '#1d1a35',
          100: '#29244d',
          200: '#38316c',
          300: '#4c4193',
          400: '#6b5ed0',
          500: '#8a7dff',
          600: '#a196ff',
          700: '#bbb4ff',
          800: '#d8d4ff',
          900: '#f0eeff',
          foreground: '#111026',
          DEFAULT: '#8a7dff'
        },
        success: '#58c48b',
        warning: '#f0ba61',
        danger: '#ef7d83'
      }
    }
  }
})
