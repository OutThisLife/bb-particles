import { fibonacci } from './fibonacci'
import { galaxySpiral } from './galaxy-spiral'
import { kaleidoscope } from './kaleidoscope'
import { solarFlare } from './solar-flare'
import { tunnel } from './tunnel'

export const presets = {
  'Fibonacci Spiral': fibonacci,
  'Galaxy Spiral': galaxySpiral,
  Kaleidoscope: kaleidoscope,
  'Solar Flare': solarFlare,
  'Tunnel Vision': tunnel
} as const

export type PresetName = keyof typeof presets
export type PresetConfig = (typeof presets)[PresetName]
