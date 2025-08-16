function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-secondary-50">
      <div className="text-center">
        <div className="text-8xl mb-6 animate-bounce">🎯</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading ChoreTracker...</h2>
        <div className="flex space-x-2 justify-center">
          <div className="h-3 w-3 bg-primary-500 rounded-full animate-pulse"></div>
          <div className="h-3 w-3 bg-secondary-500 rounded-full animate-pulse delay-75"></div>
          <div className="h-3 w-3 bg-primary-500 rounded-full animate-pulse delay-150"></div>
        </div>
      </div>
    </div>
  );
}

export default Loading;
