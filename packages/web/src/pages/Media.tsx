import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Film, Tv, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/api/client';
import { formatBytes, formatRelativeTime } from '@/utils/format';

type MediaType = 'all' | 'movie' | 'series';

export default function Media() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<MediaType>('all');
  const [searchInput, setSearchInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['media', page, type, search],
    queryFn: () => api.media.list(
      page,
      50,
      type === 'all' ? undefined : type,
      search || undefined
    ),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search media..."
              className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-border rounded-lg focus:outline-none focus:border-accent-blue"
            />
          </div>
        </form>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setType('all'); setPage(1); }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              type === 'all' ? 'bg-accent-blue text-white' : 'bg-background-secondary text-text-muted hover:text-text'
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setType('movie'); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              type === 'movie' ? 'bg-accent-yellow text-black' : 'bg-background-secondary text-text-muted hover:text-text'
            }`}
          >
            <Film className="w-4 h-4" />
            Movies
          </button>
          <button
            onClick={() => { setType('series'); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              type === 'series' ? 'bg-accent-purple text-white' : 'bg-background-secondary text-text-muted hover:text-text'
            }`}
          >
            <Tv className="w-4 h-4" />
            Series
          </button>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-text-muted">
        {data?.pagination.total ?? 0} items found
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="panel aspect-[2/3] skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {data?.items.map((item: any) => (
            <Link
              key={item.id}
              to={`/media/${item.id}`}
              className="panel overflow-hidden hover:border-accent-blue transition-colors group"
            >
              <div className="aspect-[2/3] bg-background-tertiary relative">
                {item.posterUrl ? (
                  <img
                    src={item.posterUrl}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {item.type === 'movie' ? (
                      <Film className="w-12 h-12 text-text-dim" />
                    ) : (
                      <Tv className="w-12 h-12 text-text-dim" />
                    )}
                  </div>
                )}
                {/* Type Badge */}
                <div className={`absolute top-2 left-2 px-2 py-0.5 rounded text-xs font-medium ${
                  item.type === 'movie' ? 'bg-accent-yellow text-black' : 'bg-accent-purple text-white'
                }`}>
                  {item.type === 'movie' ? 'Movie' : 'Series'}
                </div>
                {/* Quality Badge */}
                {item.quality && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium bg-accent-blue text-white">
                    {item.quality}
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium truncate group-hover:text-accent-blue transition-colors">
                  {item.title}
                </h3>
                <div className="flex justify-between items-center mt-1 text-sm text-text-muted">
                  <span>{item.year || 'N/A'}</span>
                  <span>{formatBytes(item.sizeBytes)}</span>
                </div>
                <div className="text-xs text-text-dim mt-1">
                  Added {formatRelativeTime(item.addedAt)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-2 px-4 py-2 bg-background-secondary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-background-tertiary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          <span className="text-text-muted">
            Page {page} of {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
            className="flex items-center gap-2 px-4 py-2 bg-background-secondary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-background-tertiary transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
