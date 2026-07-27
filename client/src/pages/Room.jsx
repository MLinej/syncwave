import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import createSocket, { getSocketUrl } from '../socket'
import {
  loadTrack,
  resumeAudioContext,
  clearCurrentTrack,
  play,
  pause,
  stop,
  getCurrentPosition,
  getDuration
} from '../audio/audioEngine'

const TRACK_FILES = ['audio1.mp3', 'audio2.mp3']

function formatTrackName(filename) {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const AVAILABLE_TRACKS = TRACK_FILES.map((filename) => {
  const id = filename.replace(/\.[^.]+$/, '')
  return {
    id,
    name: formatTrackName(filename),
    url: `/audio/${filename}`
  }
})

const STATUS_LABELS = {
  idle: 'Idle',
  loading: 'Loading',
  ready: 'Ready',
  error: 'Failed to load'
}

const STATUS_ICONS = {
  idle: '○',
  loading: '⏳',
  ready: '✓',
  error: '!'
}

export default function Room() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [currentTrack, setCurrentTrack] = useState(null)
  const [selectedTrackId, setSelectedTrackId] = useState(AVAILABLE_TRACKS[0].id)
  const [trackLoading, setTrackLoading] = useState(false)
  const [playbackState, setPlaybackState] = useState({ status: 'stopped', position: 0, updatedAt: null })
  const [playbackPosition, setPlaybackPosition] = useState(0)
  const [trackDuration, setTrackDuration] = useState(0)
  const [seekValue, setSeekValue] = useState(0)
  const [isSeeking, setIsSeeking] = useState(false)
  const isSeekingRef = useRef(false)

  const normalizedRoomCode = roomCode.toUpperCase()

  useEffect(() => {
    const state = window.history.state
    if (state?.userName) {
      setCurrentUser({ name: state.userName, isHost: state.isHost })
    }
    if (state?.users) {
      setUsers(state.users)
    }
    if (state?.currentTrack) {
      setCurrentTrack(state.currentTrack)
    }
    if (state?.playbackState) {
      setPlaybackState(state.playbackState)
      setPlaybackPosition(state.playbackState.position ?? 0)
      setSeekValue(state.playbackState.position ?? 0)
    }

    const s = createSocket()

    if (!s.connected) {
      s.connect()
    }

    setIsConnected(s.connected)

    const handleRoomUsers = ({ users: roomUsers, roomCode: code, currentTrack: nextTrack, playbackState: nextPlaybackState }) => {
      if (code === normalizedRoomCode) {
        setUsers(roomUsers)
        setCurrentTrack(nextTrack ?? null)
        if (nextPlaybackState) {
          setPlaybackState(nextPlaybackState)
          setPlaybackPosition(nextPlaybackState.position ?? 0)
          if (!isSeekingRef.current) {
            setSeekValue(nextPlaybackState.position ?? 0)
          }
        }
      }
    }

    const handleRoomError = ({ message }) => {
      setError(message)
    }

    const handleConnect = () => {
      setIsConnected(true)
    }

    const handleDisconnect = () => {
      setIsConnected(false)
    }

    const handleConnectError = (err) => {
      console.error('Connection error:', err.message)
      setError('Connection lost. Reconnecting...')
    }

    const handleTrackSelected = ({ roomCode: code, track }) => {
      if (code !== normalizedRoomCode) return

      setCurrentTrack(track)
      setSelectedTrackId(track.id)
      setPlaybackPosition(0)
      setSeekValue(0)
      setTrackDuration(0)
      setError('')
    }

    const handlePlaybackStateUpdated = async ({ roomCode: code, playbackState: nextPlaybackState }) => {
      if (code !== normalizedRoomCode) return

      setPlaybackState(nextPlaybackState)

      try {
        if (nextPlaybackState.status === 'playing') {
          await play(nextPlaybackState.position)
        } else if (nextPlaybackState.status === 'paused') {
          pause(nextPlaybackState.position)
        } else {
          stop()
        }
      } catch (err) {
        console.error('Playback command failed:', err)
        setError(err.message || 'Playback failed on this device')
      }

      const nextPosition = nextPlaybackState.status === 'stopped' ? 0 : nextPlaybackState.position ?? 0
      setPlaybackPosition(nextPosition)
      setSeekValue(nextPosition)
      setIsSeeking(false)
    }

    s.on('room-users', handleRoomUsers)
    s.on('room-error', handleRoomError)
    s.on('connect', handleConnect)
    s.on('disconnect', handleDisconnect)
    s.on('connect_error', handleConnectError)
    s.on('track-selected', handleTrackSelected)
    s.on('playback-state-updated', handlePlaybackStateUpdated)

    // Request current room state from server to handle race condition
    // where room-users broadcast may arrive before this component mounts
    s.emit('get-room-state', { roomCode: normalizedRoomCode })

    return () => {
      s.off('room-users', handleRoomUsers)
      s.off('room-error', handleRoomError)
      s.off('connect', handleConnect)
      s.off('disconnect', handleDisconnect)
      s.off('connect_error', handleConnectError)
      s.off('track-selected', handleTrackSelected)
      s.off('playback-state-updated', handlePlaybackStateUpdated)
    }
  }, [normalizedRoomCode])

  const copyRoomCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode.toUpperCase())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
    }
  }, [roomCode])

  const handleLoadSong = useCallback(async () => {
    const socket = createSocket()
    setTrackLoading(true)
    setError('')

    try {
      await resumeAudioContext()
      socket.emit('select-track', {
        roomCode: normalizedRoomCode,
        trackId: selectedTrackId
      })
    } catch (err) {
      console.error('Audio enable failed:', err)
      setError('Audio could not be enabled on this device')
    } finally {
      setTrackLoading(false)
    }
  }, [normalizedRoomCode, selectedTrackId])

  const emitPlaybackCommand = useCallback((eventName, payload = {}) => {
    const socket = createSocket()
    socket.emit(eventName, { roomCode: normalizedRoomCode, ...payload })
  }, [normalizedRoomCode])

  const handlePlay = useCallback(() => {
    emitPlaybackCommand('play-track')
  }, [emitPlaybackCommand])

  const handlePause = useCallback(() => {
    emitPlaybackCommand('pause-track')
  }, [emitPlaybackCommand])

  const handleStop = useCallback(() => {
    emitPlaybackCommand('stop-track')
  }, [emitPlaybackCommand])

  const handleSeekCommit = useCallback((value) => {
    setIsSeeking(false)
    isSeekingRef.current = false
    emitPlaybackCommand('seek-track', { position: value })
  }, [emitPlaybackCommand])

  const handleLeaveRoom = useCallback(() => {
    const socket = createSocket()
    socket.emit('leave-room', { roomCode: normalizedRoomCode })
    navigate('/')
  }, [navigate, normalizedRoomCode])

  const hostUser = users.find(u => u.isHost)
  const otherUsers = users.filter(u => !u.isHost)
  const readyCount = users.filter((user) => user.trackStatus === 'ready').length
  const allReady = users.length > 0 && readyCount === users.length && currentTrack
  const socket = createSocket()
  const currentSocketId = socket?.id
  const currentUserEntry = users.find((user) => user.socketId === currentSocketId)
  const currentUserStatus = currentUserEntry?.trackStatus
  const isCurrentUserHost = currentUserEntry?.isHost
  const currentTrackId = currentTrack?.id

  useEffect(() => {
    if (!currentTrackId || !currentTrack || !currentUserStatus || currentUserStatus !== 'loading') {
      return
    }

    let cancelled = false

    async function loadCurrentTrack() {
      const socket = createSocket()

      try {
        clearCurrentTrack()
        const result = await loadTrack(currentTrack, getSocketUrl())
        if (!cancelled && result.status === 'ready') {
          setTrackDuration(getDuration())
          setPlaybackPosition(0)
          setSeekValue(0)
          socket.emit('track-ready', { roomCode: normalizedRoomCode, trackId: currentTrack.id })
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Track load failed:', err)
          setError(`Failed to load ${currentTrack.name}`)
          socket.emit('track-error', { roomCode: normalizedRoomCode, trackId: currentTrack.id })
        }
      }
    }

    loadCurrentTrack()

    return () => {
      cancelled = true
    }
  }, [currentTrackId, currentUserStatus, normalizedRoomCode])

  useEffect(() => {
    let frameId = null

    const updateProgress = () => {
      const duration = getDuration()
      const position = getCurrentPosition()

      setTrackDuration(duration)
      setPlaybackPosition(position)

      if (!isSeekingRef.current) {
        setSeekValue(position)
      }

      frameId = window.requestAnimationFrame(updateProgress)
    }

    frameId = window.requestAnimationFrame(updateProgress)

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [])

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return '00:00'
    }

    const totalSeconds = Math.floor(seconds)
    const minutes = Math.floor(totalSeconds / 60)
    const remainingSeconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  const canControlPlayback = Boolean(isCurrentUserHost && currentTrack)
  const isPaused = playbackState.status === 'paused'
  const canStartPlayback = canControlPlayback && allReady
  const playbackLabel = playbackState.status === 'playing'
    ? 'Playing'
    : playbackState.status === 'paused'
      ? 'Paused'
      : 'Stopped'

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 px-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6 shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white">SyncWave</h1>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}

          <div className="mb-6">
            <p className="text-white/50 text-sm mb-1">ROOM CODE</p>
            <div className="flex items-center gap-3">
              <span className="flex-1 text-center text-3xl font-mono font-bold text-white tracking-widest bg-white/5 px-4 py-3 rounded-lg border border-white/10">
                {roomCode.toUpperCase()}
              </span>
              <button
                onClick={copyRoomCode}
                disabled={copied}
                className="px-4 py-3 bg-white/10 hover:bg-white/20 disabled:bg-green-500/30 text-white/70 hover:text-white font-medium rounded-lg border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label={copied ? 'Copied!' : 'Copy room code'}
              >
                {copied ? (
                  <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-sm">Connected Devices</span>
              <span className="text-2xl font-bold text-white">{users.length}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
              <span className="text-sm text-white/60">{isConnected ? 'Connected' : 'Reconnecting...'}</span>
            </div>
          </div>

          <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white/50 text-sm">Now Preparing</p>
                <p className="text-lg font-semibold text-white">{currentTrack ? `🎵 ${currentTrack.name}` : 'No song selected yet'}</p>
              </div>
              {allReady && (
                <span className="text-sm font-medium text-green-300">All devices ready</span>
              )}
            </div>

            {isCurrentUserHost && (
              <div className="mt-4 space-y-3">
                <p className="text-white/70 text-sm">Available Songs</p>
                <div className="space-y-2">
                  {AVAILABLE_TRACKS.map((track) => (
                    <label key={track.id} className="flex items-center gap-3 text-white/80">
                      <input
                        type="radio"
                        name="track"
                        value={track.id}
                        checked={selectedTrackId === track.id}
                        onChange={(event) => setSelectedTrackId(event.target.value)}
                        className="accent-indigo-500"
                      />
                      <span>{track.name}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleLoadSong}
                  disabled={trackLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-indigo-900"
                >
                  {trackLoading ? 'Loading Song...' : 'Load Song'}
                </button>
              </div>
            )}
          </div>

          <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white/50 text-sm">Playback</p>
                <p className="text-lg font-semibold text-white">{currentTrack ? currentTrack.name : 'Select a song to begin'}</p>
              </div>
              <span className="text-sm text-white/70">{playbackLabel}</span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-white/60">
                <span>{formatTime(playbackPosition)}</span>
                <span>{formatTime(trackDuration)}</span>
              </div>

              <input
                type="range"
                min="0"
                max={Math.max(trackDuration, 0)}
                step="0.01"
                value={Math.min(seekValue, trackDuration || seekValue || 0)}
                onChange={(event) => {
                  setIsSeeking(true)
                  isSeekingRef.current = true
                  setSeekValue(Number(event.target.value))
                }}
                onMouseUp={(event) => handleSeekCommit(Number(event.target.value))}
                onTouchEnd={(event) => handleSeekCommit(Number(event.target.value))}
                onKeyUp={(event) => handleSeekCommit(Number(event.target.value))}
                disabled={!canControlPlayback || !trackDuration}
                className="mt-3 w-full accent-indigo-500 disabled:opacity-50"
              />
            </div>

            {isCurrentUserHost ? (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={isPaused || playbackState.status === 'stopped' ? handlePlay : handlePause}
                  disabled={playbackState.status === 'playing' ? !canControlPlayback : !canStartPlayback}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-indigo-900"
                >
                  {playbackState.status === 'playing' ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={handleStop}
                  disabled={!canControlPlayback}
                  className="flex-1 py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white font-semibold rounded-lg border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-indigo-900"
                >
                  Stop
                </button>
              </div>
            ) : (
              <div className="mt-4 text-sm text-white/60">
                {currentTrack ? `${playbackLabel}. Controlled by Host.` : 'Waiting for the host to choose a song.'}
              </div>
            )}
          </div>

          <div className="space-y-2">
            {hostUser && (
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                <span className="text-yellow-400 text-xl">👑</span>
                <div className="flex-1">
                  <p className="font-medium text-white">{hostUser.name}</p>
                  <p className="text-xs text-white/50">Host</p>
                </div>
                <span className={`text-sm ${hostUser.trackStatus === 'error' ? 'text-red-300' : 'text-white/70'}`}>
                  {STATUS_ICONS[hostUser.trackStatus]} {STATUS_LABELS[hostUser.trackStatus]}
                </span>
                {currentUser?.name === hostUser.name && (
                  <span className="text-xs px-2 py-1 bg-indigo-500/30 text-indigo-300 rounded-full">You</span>
                )}
              </div>
            )}

            {otherUsers.map((user) => (
              <div key={user.name} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{user.name}</p>
                </div>
                <span className={`text-sm ${user.trackStatus === 'error' ? 'text-red-300' : 'text-white/70'}`}>
                  {STATUS_ICONS[user.trackStatus]} {STATUS_LABELS[user.trackStatus]}
                </span>
                {currentUser?.name === user.name && (
                  <span className="text-xs px-2 py-1 bg-indigo-500/30 text-indigo-300 rounded-full">You</span>
                )}
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-8 text-white/50">
                <p>Waiting for users to join...</p>
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-white/60">
            {readyCount} / {users.length} devices ready
          </div>

          <button
            onClick={handleLeaveRoom}
            className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-indigo-900"
          >
            Leave Room
          </button>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Share the room code above with friends to connect
        </p>
      </div>
    </div>
  )
}
