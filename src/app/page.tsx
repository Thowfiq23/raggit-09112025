import RepoInputForm from '../components/RepoInputForm';
import RepoList from '../components/RepoList';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-4">
            RagGit
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto">
            Chat With Any GitHub Repository
          </p>
          <p className="text-gray-400 mt-4 max-w-lg mx-auto">
            Analyze and interact with any GitHub repository using AI. 
            Simply paste the repository URL to get started.
          </p>
        </div>

        {/* Repo Input Form */}
        <div className="w-full max-w-3xl">
          <RepoInputForm />
        </div>

        {/* Repo List */}
        <div className="w-full max-w-4xl mt-16 bg-white text-gray-900 rounded-xl shadow-lg">
          <RepoList />
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-4xl">
          <div className="text-center p-6 bg-gray-800 rounded-xl border border-gray-700">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Fast Processing</h3>
            <p className="text-gray-400 text-sm">
              Quickly analyze repository structure and codebase with our optimized pipeline
            </p>
          </div>

          <div className="text-center p-6 bg-gray-800 rounded-xl border border-gray-700">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">AI-Powered Chat</h3>
            <p className="text-gray-400 text-sm">
              Have intelligent conversations about the codebase with our advanced AI system
            </p>
          </div>

          <div className="text-center p-6 bg-gray-800 rounded-xl border border-gray-700">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Code Analysis</h3>
            <p className="text-gray-400 text-sm">
              Deep understanding of code structure, dependencies, and architecture
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-gray-500 text-sm">
          <p>Built with Next.js, TypeScript, and Tailwind CSS</p>
        </div>
      </div>
    </main>
  );
}