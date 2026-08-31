import { AlarmClock, FolderOpen, Loader2, MapPin, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CARE_TILE_CLASS, careStatus } from '../lib/utils/care'
import { SURVIVAL_TEXT_CLASS, survivalLevel } from '../lib/utils/survival'
import type { Folder } from '../types/database'

interface Props {
  folder: Folder
  experimentCount?: number
  plantTotal?: number
  aliveTotal?: number
  onDelete: (id: string) => Promise<void>
}

export default function FolderCard({
  folder,
  experimentCount,
  plantTotal,
  aliveTotal,
  onDelete,
}: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const care = careStatus(folder)

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete(folder.id)
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg bg-surface-container ring-1 ring-outline-variant">
      <Link
        to={`/folders/${folder.id}`}
        state={{ folder }}
        className="flex flex-1 flex-col"
      >
        <div className="flex aspect-video items-center justify-center bg-surface-variant">
          {folder.cover_image_url ? (
            <img
              src={folder.cover_image_url}
              alt={folder.title}
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <FolderOpen className="size-10 text-on-surface-variant/50" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <h2 className="line-clamp-2 font-medium text-on-surface">
            {folder.title}
          </h2>
          {/* Only surface a chore that actually needs doing — an upcoming one is
              just noise on a grid of cards. */}
          {care && care.state !== 'upcoming' && (
            <p
              className={`flex items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-medium ${
                CARE_TILE_CLASS[care.state]
              }`}
            >
              <AlarmClock className="size-3 shrink-0" />
              {care.label} · {care.text.toLowerCase()}
            </p>
          )}
          {experimentCount != null && (
            <div className="text-sm text-on-surface-variant">
              <p>
                Experiments: {experimentCount}
              </p>
              {plantTotal != null &&
                (aliveTotal != null ? (
                  <p>
                    <span
                      className={
                        SURVIVAL_TEXT_CLASS[
                          survivalLevel(
                            plantTotal > 0 ? aliveTotal / plantTotal : null,
                          )
                        ]
                      }
                    >
                      {aliveTotal}/{plantTotal}
                    </span>{' '}
                    plants alive
                  </p>
                ) : (
                  <p>
                    {plantTotal} plant{plantTotal === 1 ? '' : 's'}
                  </p>
                ))}
            </div>
          )}
          {folder.origin && (
            <p className="mt-auto flex items-center gap-1 text-xs text-on-surface-variant">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{folder.origin}</span>
            </p>
          )}
        </div>
      </Link>

      {confirming ? (
        <div className="flex items-center gap-2 border-t border-outline-variant p-2">
          <span className="flex-1 text-xs text-on-surface-variant">
            Delete this folder and everything in it?
          </span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-lg px-2 py-1 text-xs font-medium text-on-surface-variant hover:bg-surface-variant"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="flex items-center gap-1 rounded-lg bg-error px-2 py-1 text-xs font-medium text-on-error disabled:opacity-60"
          >
            {deleting && <Loader2 className="size-3 animate-spin" />}
            Delete
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title="Delete folder"
          className="absolute right-2 top-2 rounded-lg bg-surface/80 p-1.5 text-on-surface-variant backdrop-blur hover:bg-surface hover:text-error"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}
