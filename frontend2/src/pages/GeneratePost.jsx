import { useEffect, useState } from 'react'
import {
  FiZap,
  FiCopy,
  FiDownload,
  FiCheck,
  FiHash,
  FiType,
  FiClock,
  FiImage,
} from 'react-icons/fi'
import Layout from '../components/Layout'
import Spinner from '../components/Spinner'
import ErrorAlert from '../components/ErrorAlert'
import DashboardInsights from '../components/DashboardInsights'
import { fetchTopics, generatePost, generateImage } from '../api/endpoints'
import { getPreferences } from '../utils/preferences'

function GeneratePost() {
  const [topics, setTopics] = useState([])
  const [lengthOptions, setLengthOptions] = useState(['Short', 'Medium', 'Long'])
  const [languageOptions, setLanguageOptions] = useState(['English', 'Hinglish'])

  const savedPreferences = getPreferences()

  const [topic, setTopic] = useState('')
  const [topicMode, setTopicMode] = useState('existing')
  const [customTopic, setCustomTopic] = useState('')
  const [length, setLength] = useState(savedPreferences.defaultLength)
  const [language, setLanguage] = useState(savedPreferences.defaultLanguage)

  const [loadingTopics, setLoadingTopics] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [generatingImage, setGeneratingImage] = useState(false)
  const [generatedImage, setGeneratedImage] = useState(null)
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadTopics = async () => {
      try {
        const data = await fetchTopics()
        if (!isMounted) return

        setTopics(data.topics || [])
        setLengthOptions(data.length_options || ['Short', 'Medium', 'Long'])
        setLanguageOptions(data.language_options || ['English', 'Hinglish'])

        if (data.topics && data.topics.length > 0) {
          setTopic(data.topics[0])
        }
      } catch (err) {
        if (isMounted) {
          setError(err.friendlyMessage || 'Failed to load topics.')
        }
      } finally {
        if (isMounted) setLoadingTopics(false)
      }
    }

    loadTopics()
    return () => {
      isMounted = false
    }
  }, [])

  const handleGenerate = async () => {
    const trimmedCustomTopic = customTopic.trim()
    if (topicMode === 'custom' && !trimmedCustomTopic) {
      setError('Please enter a custom topic before generating a post.')
      return
    }
    if (topicMode === 'existing' && !topic) {
      setError('Please choose a topic before generating a post.')
      return
    }

    setError('')
    setGenerating(true)
    setResult(null)
    setCopied(false)
    setGeneratedImage(null)
    setImageError('')
    setGeneratingImage(false)

    try {
      const payload = topicMode === 'custom'
        ? { custom_topic: trimmedCustomTopic, length, language }
        : { topic, length, language }
      const data = await generatePost(payload)
      if (!data?.post) {
        setError('The server returned an empty post. Please try again.')
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err.friendlyMessage || 'Failed to generate post.')
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async () => {
    if (!result?.post) return
    try {
      await navigator.clipboard.writeText(result.post)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard. Please copy manually.')
    }
  }

  const handleDownload = () => {
    if (!result?.post) return
    const blob = new Blob([result.post], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `linkedin_post_${Date.now()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleGenerateImage = async () => {
    if (!result?.post) return
    setImageError('')
    setGeneratingImage(true)

    try {
      const data = await generateImage({
        post: result.post,
        topic: result.topic || (topicMode === 'custom' ? customTopic.trim() : topic),
      })
      if (!data?.image) {
        setImageError('The server did not return an image. Please try again.')
      } else {
        setGeneratedImage(data)
      }
    } catch (err) {
      setImageError(err.friendlyMessage || 'Failed to generate image. Please try again.')
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleDownloadImage = () => {
    if (!generatedImage?.image) return
    const link = document.createElement('a')
    link.href = generatedImage.image
    link.download = `linkedin_image_${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <Layout
      title="Generate Post"
      subtitle="Create an AI-powered LinkedIn post"
      rightSidebar={<DashboardInsights />}
    >
      <div className="space-y-4">
        {error && <ErrorAlert message={error} onClose={() => setError('')} />}

        {/* Generator Card */}
        <section className="app-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiZap className="text-linkedin" /> Post Generator
          </h2>

          {/* Topic source selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              How would you like to choose a topic?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setTopicMode('existing'); setError('') }}
                aria-pressed={topicMode === 'existing'}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  topicMode === 'existing'
                    ? 'border-linkedin bg-linkedin-light ring-1 ring-linkedin/20'
                    : 'border-gray-200 hover:border-linkedin/40'
                }`}
              >
                <span className="block text-sm font-semibold text-gray-800">Choose an existing topic</span>
                <span className="mt-1 block text-xs text-gray-500">Uses relevant examples from your RAG dataset</span>
              </button>
              <button
                type="button"
                onClick={() => { setTopicMode('custom'); setError('') }}
                aria-pressed={topicMode === 'custom'}
                className={`rounded-xl border px-4 py-3 text-left transition-all ${
                  topicMode === 'custom'
                    ? 'border-linkedin bg-linkedin-light ring-1 ring-linkedin/20'
                    : 'border-gray-200 hover:border-linkedin/40'
                }`}
              >
                <span className="block text-sm font-semibold text-gray-800">Enter a custom topic</span>
                <span className="mt-1 block text-xs text-gray-500">Bypasses RAG and generates directly with the LLM</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Existing or custom topic */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {topicMode === 'custom' ? 'Your custom topic' : 'Topic'}
              </label>
              {topicMode === 'custom' ? (
                <>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="e.g. Quantum Computing in Healthcare"
                    maxLength={200}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerate() }}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700
                    focus:outline-none focus:ring-2 focus:ring-linkedin/40 focus:border-linkedin transition-all"
                  />
                  <p className="mt-1.5 text-xs text-gray-400">Any topic, even if it is not in your dataset.</p>
                </>
              ) : (
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={loadingTopics}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700
                  focus:outline-none focus:ring-2 focus:ring-linkedin/40 focus:border-linkedin transition-all disabled:opacity-60"
                >
                  {loadingTopics && <option value="">Loading topics...</option>}
                  {!loadingTopics && topics.length === 0 && (
                    <option value="">No topics available</option>
                  )}
                  {topics.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Length */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Length
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700
                focus:outline-none focus:ring-2 focus:ring-linkedin/40 focus:border-linkedin transition-all"
              >
                {lengthOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-700
                focus:outline-none focus:ring-2 focus:ring-linkedin/40 focus:border-linkedin transition-all"
              >
                {languageOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || (topicMode === 'existing' && (loadingTopics || !topic)) || (topicMode === 'custom' && !customTopic.trim())}
            className="mt-5 w-full flex items-center justify-center gap-2 bg-linkedin text-white font-semibold
            rounded-xl py-3 text-sm hover:bg-linkedin-dark active:scale-[0.99] transition-all duration-200
            disabled:opacity-60 disabled:cursor-not-allowed shadow-card"
          >
            {generating ? (
              <>
                <Spinner size={16} /> Generating your post...
              </>
            ) : (
              <>
                <FiZap size={16} /> Generate LinkedIn Post
              </>
            )}
          </button>
        </section>

        {/* Result Card */}
        {result && (
          <section className="app-card p-5 sm:p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">✨ Your LinkedIn Post</h3>
              <span className="text-xs bg-linkedin-light text-linkedin px-2.5 py-1 rounded-full font-medium">
                {result.topic}
              </span>
            </div>

            <textarea
              readOnly
              value={result.post}
              className="w-full min-h-[260px] rounded-xl border border-gray-200 p-4 text-sm text-gray-700
              leading-relaxed focus:outline-none focus:ring-2 focus:ring-linkedin/30 resize-y"
            />

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <FiType className="mx-auto mb-1 text-linkedin" size={16} />
                <p className="text-sm font-semibold text-gray-900">{result.character_count}</p>
                <p className="text-xs text-gray-400">Characters</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <FiHash className="mx-auto mb-1 text-linkedin" size={16} />
                <p className="text-sm font-semibold text-gray-900">{result.word_count}</p>
                <p className="text-xs text-gray-400">Words</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <FiClock className="mx-auto mb-1 text-linkedin" size={16} />
                <p className="text-sm font-semibold text-gray-900">{result.reading_time_minutes} min</p>
                <p className="text-xs text-gray-400">Reading Time</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium
                text-gray-700 hover:bg-gray-50 hover:border-linkedin/40 transition-all duration-200"
              >
                {copied ? <FiCheck className="text-green-600" size={16} /> : <FiCopy size={16} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-linkedin text-white rounded-xl py-2.5 text-sm font-medium
                hover:bg-linkedin-dark transition-all duration-200"
              >
                <FiDownload size={16} /> Download
              </button>
            </div>

            {/* Image Generation Section */}
            <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
              <button
                onClick={handleGenerateImage}
                disabled={generatingImage}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-medium
                text-gray-700 hover:bg-gray-50 hover:border-linkedin/40 transition-all duration-200 disabled:opacity-60"
              >
                {generatingImage ? (
                  <>
                    <Spinner size={16} /> Generating image...
                  </>
                ) : (
                  <>
                    <FiImage size={16} className="text-linkedin" />
                    {generatedImage ? 'Regenerate Image' : 'Generate Image'}
                  </>
                )}
              </button>

              {imageError && (
                <ErrorAlert message={imageError} onClose={() => setImageError('')} />
              )}

              {generatedImage && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      ✨ AI-Generated Illustration (16:9)
                    </span>
                    <button
                      onClick={handleDownloadImage}
                      className="inline-flex items-center gap-1.5 text-xs text-linkedin hover:underline font-medium"
                    >
                      <FiDownload size={14} /> Download Image
                    </button>
                  </div>
                  <img
                    src={generatedImage.image}
                    alt="LinkedIn post illustration"
                    className="w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </Layout>
  )
}

export default GeneratePost
