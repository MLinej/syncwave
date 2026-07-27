let audioContext = null
let currentAudioBuffer = null
let currentTrackId = null
let activeLoadId = 0
let activeAbortController = null
let currentSourceNode = null
let currentOffset = 0
let startedAt = 0
let isPlaying = false

function createAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser')
  }

  return new AudioContextClass()
}

export function getAudioContext() {
  if (typeof window === 'undefined') {
    return null
  }

  if (!audioContext) {
    audioContext = createAudioContext()
  }

  return audioContext
}

export async function resumeAudioContext() {
  const context = getAudioContext()
  if (!context) return null

  if (context.state === 'suspended') {
    await context.resume()
  }

  return context
}

export function getCurrentAudioBuffer() {
  return currentAudioBuffer
}

function stopCurrentSource({ keepOffset = true } = {}) {
  if (!currentSourceNode) {
    return
  }

  const sourceToStop = currentSourceNode
  currentSourceNode = null

  sourceToStop.onended = null

  try {
    sourceToStop.stop()
  } catch (error) {
  }

  if (!keepOffset) {
    currentOffset = 0
  }
}

function clampOffset(offset) {
  const duration = currentAudioBuffer?.duration ?? 0

  if (!Number.isFinite(offset) || offset <= 0) {
    return 0
  }

  if (duration > 0) {
    return Math.min(offset, duration)
  }

  return offset
}

export function clearCurrentTrack() {
  activeLoadId += 1
  stopCurrentSource({ keepOffset: false })
  currentTrackId = null
  currentAudioBuffer = null
  startedAt = 0
  isPlaying = false
  if (activeAbortController) {
    activeAbortController.abort()
    activeAbortController = null
  }
}

export async function loadTrack(track, baseUrl) {
  const context = getAudioContext()
  const loadId = activeLoadId + 1
  activeLoadId = loadId

  if (activeAbortController) {
    activeAbortController.abort()
  }

  currentTrackId = track.id
  currentAudioBuffer = null
  activeAbortController = new AbortController()

  const trackUrl = new URL(track.url, baseUrl).toString()

  try {
    const response = await fetch(trackUrl, { signal: activeAbortController.signal })
    if (!response.ok) {
      throw new Error(`Failed to fetch track: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await context.decodeAudioData(arrayBuffer)

    if (loadId !== activeLoadId || currentTrackId !== track.id) {
      return { status: 'stale', trackId: track.id }
    }

    currentAudioBuffer = audioBuffer
    currentOffset = 0
    startedAt = 0
    isPlaying = false
    return { status: 'ready', trackId: track.id, audioBuffer }
  } catch (error) {
    if (error.name === 'AbortError' || loadId !== activeLoadId || currentTrackId !== track.id) {
      return { status: 'stale', trackId: track.id }
    }

    currentAudioBuffer = null
    throw error
  } finally {
    if (loadId === activeLoadId) {
      activeAbortController = null
    }
  }
}

export function getDuration() {
  return currentAudioBuffer?.duration ?? 0
}

export function getIsPlaying() {
  return isPlaying
}

export function getCurrentPosition() {
  if (!currentAudioBuffer) {
    return 0
  }

  if (!isPlaying) {
    return clampOffset(currentOffset)
  }

  const context = getAudioContext()
  const elapsed = context ? context.currentTime - startedAt : 0
  return clampOffset(currentOffset + elapsed)
}

export async function play(offset = currentOffset) {
  if (!currentAudioBuffer) {
    throw new Error('No track is loaded')
  }

  const context = await resumeAudioContext()
  const nextOffset = clampOffset(offset)

  stopCurrentSource()

  if (nextOffset >= currentAudioBuffer.duration) {
    currentOffset = 0
    startedAt = 0
    isPlaying = false
    return 0
  }

  const source = context.createBufferSource()
  source.buffer = currentAudioBuffer
  source.connect(context.destination)

  source.onended = () => {
    if (currentSourceNode !== source) {
      return
    }

    currentSourceNode = null
    isPlaying = false
    currentOffset = 0
    startedAt = 0
  }

  startedAt = context.currentTime
  currentOffset = nextOffset
  currentSourceNode = source
  isPlaying = true
  source.start(context.currentTime, nextOffset)

  return nextOffset
}

export function pause(offset = null) {
  if (!currentAudioBuffer) {
    currentOffset = 0
    isPlaying = false
    startedAt = 0
    return currentOffset
  }

  const pausedAt = clampOffset(offset ?? getCurrentPosition())
  stopCurrentSource()
  currentOffset = pausedAt
  startedAt = 0
  isPlaying = false
  return currentOffset
}

export function stop() {
  stopCurrentSource({ keepOffset: false })
  currentOffset = 0
  startedAt = 0
  isPlaying = false
  return currentOffset
}

export async function seek(seconds) {
  const nextOffset = clampOffset(seconds)

  if (!currentAudioBuffer) {
    currentOffset = nextOffset
    return currentOffset
  }

  if (isPlaying) {
    await play(nextOffset)
    return nextOffset
  }

  currentOffset = nextOffset
  return currentOffset
}
