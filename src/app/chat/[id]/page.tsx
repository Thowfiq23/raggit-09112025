'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';

interface Message {
  role: 'user' | 'ai';
  content: string;
  sources?: any[];
}

export default function ChatPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const [repoName, setRepoName] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [repoLoading, setRepoLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Validate ID and fetch repository
  useEffect(() => {
    const fetchRepoData = async () => {
      try {
        // Validate the ID parameter
        if (!id) {
          setError('Invalid repository ID');
          setRepoLoading(false);
          return;
        }

        const repoId = parseInt(id);
        if (isNaN(repoId)) {
          setError('Invalid repository ID');
          setRepoLoading(false);
          return;
        }

        const { data, error: supabaseError } = await supabase
          .from('repositories')
          .select('repo_name, status')
          .eq('id', repoId)
          .single();

        if (supabaseError) {
          console.error('Supabase error:', supabaseError);
          if (supabaseError.code === 'PGRST116') {
            setError('Repository not found');
          } else {
            setError('Error loading repository');
          }
          setRepoLoading(false);
          return;
        }

        if (!data) {
          setError('Repository not found');
          setRepoLoading(false);
          return;
        }

        setRepoName(data.repo_name);
        
        // Check if repository is ready for chatting
        if (data.status !== 'completed') {
          setError(`Repository is still ${data.status}. Please wait until processing is complete.`);
        }
        
      } catch (error) {
        console.error('Unexpected error:', error);
        setError('An unexpected error occurred');
      } finally {
        setRepoLoading(false);
      }
    };

    fetchRepoData();
  }, [id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: query.trim(),
    };

    setLoading(true);
    setMessages(prev => [...prev, userMessage]);
    const currentQuery = query;
    setQuery('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoId: parseInt(id || ''),
          query: currentQuery,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const aiMessage: Message = {
        role: 'ai',
        content: data.answer,
        sources: data.sources || [],
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        role: 'ai',
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Show error state
  if (error && !repoLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Repository Not Found</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <Link 
            href="/" 
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/" 
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Home</span>
            </Link>
            
            <div className="flex-1 text-center">
              {repoLoading ? (
                <div className="space-y-2">
                  <div className="h-6 bg-gray-700 rounded w-48 mx-auto animate-pulse"></div>
                  <div className="h-4 bg-gray-700 rounded w-32 mx-auto animate-pulse"></div>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-semibold truncate max-w-md mx-auto">
                    {repoName || 'Chat'}
                  </h1>
                  <p className="text-sm text-gray-400">Repository ID: {id}</p>
                </>
              )}
            </div>

            <div className="w-24"></div> {/* Spacer for balance */}
          </div>
        </div>
      </header>

      {/* Messages Container */}
      <div className="flex-1 container mx-auto px-4 py-6 flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-6 mb-4">
          {messages.length === 0 && !repoLoading && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-300 mb-2">Start a conversation</h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Ask questions about the codebase, architecture, or specific implementation details.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                
                {/* Sources */}
                {message.role === 'ai' && message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Sources:</h4>
                    <div className="space-y-2">
                      {message.sources.map((source: any, sourceIndex: number) => (
                        <div
                          key={sourceIndex}
                          className="bg-gray-900 rounded-lg p-3 text-sm"
                        >
                          {source.file_path && (
                            <div className="font-mono text-blue-400 text-xs mb-1">
                              {source.file_path}
                            </div>
                          )}
                          {source.content && (
                            <div className="text-gray-300 mt-1">
                              <pre className="whitespace-pre-wrap text-xs font-mono">
                                {source.content}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-3xl rounded-2xl px-4 py-3 bg-gray-800 text-gray-100">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-400">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="sticky bottom-0 bg-gray-900 pt-4 pb-6">
          <div className="flex space-x-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about the codebase..."
              disabled={loading || !!error}
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white placeholder-gray-400 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !query.trim() || !!error}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                loading || !query.trim() || !!error
                  ? 'bg-gray-700 cursor-not-allowed text-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
              }`}
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                'Send'
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {error ? 'Cannot send messages due to repository error' : 'Ask about code structure, implementation details, or specific files in the repository.'}
          </p>
        </form>
      </div>
    </div>
  );
}
