import type { Meta, StoryObj } from '@storybook/react'
import LoadingSpinner from './LoadingSpinner'

const meta: Meta<typeof LoadingSpinner> = {
  title:     'Common/LoadingSpinner',
  component: LoadingSpinner,
  tags:      ['autodocs'],
  argTypes: {
    fullScreen: { control: 'boolean' },
    message:    { control: 'text' },
    size:       { control: { type: 'range', min: 20, max: 120, step: 4 } },
  },
  args: {
    fullScreen: false,
    size:       40,
  },
}

export default meta

type Story = StoryObj<typeof LoadingSpinner>

export const Default: Story = {}

export const WithMessage: Story = {
  args: { message: 'Loading metrics…' },
}

export const FetchingTraces: Story = {
  args: { message: 'Fetching distributed traces…', size: 48 },
}

export const Large: Story = {
  args: { size: 80, message: 'Generating report…' },
}

// Note: FullScreen story is intentionally excluded from the default Storybook
// view because it overlays the entire canvas. Test manually via args toggle.
