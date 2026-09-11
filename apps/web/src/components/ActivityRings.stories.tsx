import type { Meta, StoryObj } from '@storybook/react';
import { ActivityRings } from './ActivityRings';

const meta: Meta<typeof ActivityRings> = {
  title: 'Portal Rodziny/ActivityRings (Metryki Behawioralne)',
  component: ActivityRings,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ActivityRings>;

export const DefaultProgress: Story = {
  args: {
    stepsProgress: 0.75,
    activityProgress: 0.5,
    sleepProgress: 0.9,
  },
};

export const CompleteRings: Story = {
  args: {
    stepsProgress: 1.0,
    activityProgress: 1.0,
    sleepProgress: 1.0,
  },
};

export const LowActivity: Story = {
  args: {
    stepsProgress: 0.2,
    activityProgress: 0.15,
    sleepProgress: 0.6,
  },
};
