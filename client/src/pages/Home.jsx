import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import createSocket from '../socket'
import { resumeAudioContext } from '../audio/audioEngine'

export default function Home() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [joinName, setJoinName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [joinLoading, setJoinLoading] = useState(false)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    const s = createSocket()

    if (!s.connected) {
      s.connect()
    }

    const handleConnect = () => {
      console.log('Connected to server:', s.id)
      setError('')
    }
    const handleDisconnect = () => {
      console.log('Disconnected')
    }
    const handleConnectError = (err) => {
      console.error('Connection error:', err.message)
      setError('Cannot connect to server. Make sure backend is running.')
    }

    s.on('connect', handleConnect)
    s.on('disconnect', handleDisconnect)
    s.on('connect_error', handleConnectError)

    setSocket(s)

    return () => {
      s.off('connect', handleConnect)
      s.off('disconnect', handleDisconnect)
      s.off('connect_error', handleConnectError)
    }
  }, [])

  const handleCreateRoom = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Please enter your name')
      return
    }
    setError('')
    setCreateLoading(true)

    try {
      await resumeAudioContext()
    } catch (err) {
      console.error('Audio setup failed:', err)
    }

    const handleCreated = ({ roomCode: code, users }) => {
      socket.off('room-created', handleCreated)
      socket.off('room-error', handleError)
      setCreateLoading(false)
      navigate(`/room/${code}`, {
        state: { userName: trimmedName, isHost: true, users }
      })
    }

    const handleError = ({ message }) => {
      socket.off('room-created', handleCreated)
      socket.off('room-error', handleError)
      setCreateLoading(false)
      setError(message)
    }

    socket.on('room-created', handleCreated)
    socket.on('room-error', handleError)
    socket.emit('create-room', { name: trimmedName })
  }

  const handleJoinRoom = async () => {
    const trimmedName = joinName.trim()
    const trimmedCode = roomCode.trim().toUpperCase()

    if (!trimmedName) {
      setError('Please enter your name')
      return
    }
    if (!trimmedCode) {
      setError('Please enter a room code')
      return
    }
    if (trimmedCode.length !== 6) {
      setError('Room code must be 6 characters')
      return
    }

    setError('')
    setJoinLoading(true)

    try {
      await resumeAudioContext()
    } catch (err) {
      console.error('Audio setup failed:', err)
    }

    const handleJoined = ({ roomCode: code, users }) => {
      socket.off('room-joined', handleJoined)
      socket.off('room-error', handleError)
      setJoinLoading(false)
      navigate(`/room/${code}`, {
        state: { userName: trimmedName, isHost: false, users }
      })
    }

    const handleError = ({ message }) => {
      socket.off('room-joined', handleJoined)
      socket.off('room-error', handleError)
      setJoinLoading(false)
      setError(message)
    }

    socket.on('room-joined', handleJoined)
    socket.on('room-error', handleError)
    socket.emit('join-room', { name: trimmedName, roomCode: trimmedCode })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-white tracking-tight">SyncWave</h1>
            <p className="text-white/70 mt-2 text-lg">Turn everyone's phone into one speaker.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg text-sm" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="create-name" className="block text-white/70 text-sm font-medium mb-2">
                Your Name
              </label>
              <input
                id="create-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                disabled={createLoading}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="Enter your name"
                autoFocus
              />
            </div>

            <button
              onClick={handleCreateRoom}
              disabled={createLoading || !name.trim()}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-indigo-900"
            >
              {createLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Room'
              )}
            </button>
          </div>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/10 text-white/50">OR</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="join-name" className="block text-white/70 text-sm font-medium mb-2">
                Your Name
              </label>
              <input
                id="join-name"
                type="text"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                disabled={joinLoading}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label htmlFor="room-code" className="block text-white/70 text-sm font-medium mb-2">
                Room Code
              </label>
              <input
                id="room-code"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                disabled={joinLoading}
                maxLength={6}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 tracking-widest text-center"
                placeholder="A7K2PQ"
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={joinLoading || !joinName.trim() || !roomCode.trim()}
              className="w-full py-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 text-white font-semibold rounded-lg border border-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-indigo-900"
            >
              {joinLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Joining...
                </span>
              ) : (
                'Join Room'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
