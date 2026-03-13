'use client';

import { SpotifyPlaylist } from '@/types/spotify';

interface Props {
  playlist: SpotifyPlaylist;
  onSelect: (playlist: SpotifyPlaylist) => void;
  isSelected?: boolean;
  isLoading?: boolean;
}

export default function PlaylistCard({ playlist, onSelect, isSelected, isLoading }: Props) {
  const image = playlist.images?.[0]?.url;

  return (
    <button
      onClick={() => onSelect(playlist)}
      disabled={isLoading}
      className={`flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all ${
        isSelected
          ? 'bg-green-600 border border-green-500'
          : 'bg-gray-800 border border-gray-700 hover:border-gray-500 hover:bg-gray-750'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {image ? (
        <img
          src={image}
          alt={playlist.name}
          className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">🎵</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-gray-100'}`}>
          {playlist.name}
        </p>
        <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-green-200' : 'text-gray-400'}`}>
          {playlist.tracks.total} tracks • {playlist.owner.display_name}
        </p>
        {playlist.description && (
          <p className={`text-xs truncate mt-0.5 ${isSelected ? 'text-green-100' : 'text-gray-500'}`}
             dangerouslySetInnerHTML={{ __html: playlist.description }}
          />
        )}
      </div>
      {isSelected && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
    </button>
  );
}
