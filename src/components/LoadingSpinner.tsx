export const LoadingSpinner: React.FC = () => (
  <div className="fixed top-4 right-4 flex items-center gap-2 bg-[#2a2a2a] px-3 py-2 rounded-lg shadow-lg">
    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
    <span className="text-sm text-gray-300">Loading...</span>
  </div>
); 