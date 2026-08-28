import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { DateLog, Experiment } from '../../types/database'

/** A4 at ~96dpi, in CSS px — the render width of the hidden template. */
const TEMPLATE_WIDTH = 794
/** Page margin on every side, in mm. */
const MARGIN = 14
/** Vertical gap between blocks, in mm. */
const BLOCK_GAP = 4

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatLogDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'experiment'
  )
}

function esc(value: string) {
  const el = document.createElement('div')
  el.textContent = value
  return el.innerHTML
}

/** Resolve once every <img> inside the node has loaded (or failed). */
function waitForImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll('img'))
  return Promise.all(
    images.map((img) => {
      img.crossOrigin = 'anonymous'
      if (img.complete && img.naturalWidth > 0) return undefined
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )
}

function makeBlock(html: string) {
  const block = document.createElement('div')
  block.style.cssText = 'width:100%;box-sizing:border-box'
  block.innerHTML = html
  return block
}

/**
 * Build the off-screen template as a list of self-contained blocks. Each block
 * is rasterised separately so the PDF can page-break *between* blocks instead of
 * slicing through text or an image.
 */
function buildTemplate(experiment: Experiment, dateLogs: DateLog[]) {
  const container = document.createElement('div')
  container.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${TEMPLATE_WIDTH}px`,
    'padding:0',
    'background:#ffffff',
    'color:#1a1c19',
    "font-family:'Roboto',system-ui,'Segoe UI',sans-serif",
    'font-size:14px',
    'line-height:1.5',
  ].join(';')

  const blocks: HTMLElement[] = []

  blocks.push(
    makeBlock(
      `<h1 style="margin:0 0 4px;font-size:26px;font-weight:500">${esc(
        experiment.title,
      )}</h1>
       <div style="color:#424940;font-size:13px">Plant experiment history</div>`,
    ),
  )

  if (experiment.cover_image_url) {
    blocks.push(
      makeBlock(
        `<img src="${esc(
          experiment.cover_image_url,
        )}" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px" />`,
      ),
    )
  }

  const facts: string[] = [
    `<strong>Plants:</strong> ${esc(String(experiment.plant_count))}`,
    `<strong>Origin:</strong> ${esc(experiment.origin)}`,
  ]
  if (experiment.initial_price != null) {
    facts.push(
      `<strong>Initial price:</strong> $${experiment.initial_price.toFixed(2)}`,
    )
  }
  facts.push(`<strong>Created:</strong> ${formatDate(experiment.created_at)}`)
  blocks.push(
    makeBlock(
      `<div style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:13px">
        ${facts.map((f) => `<div>${f}</div>`).join('')}
      </div>`,
    ),
  )

  if (experiment.notes) {
    blocks.push(
      makeBlock(
        `<p style="white-space:pre-wrap;margin:0;padding:12px 16px;background:#f0f1ec;border-radius:12px">${esc(
          experiment.notes,
        )}</p>`,
      ),
    )
  }

  const timelineHeading = `<h2 style="margin:0 0 12px;font-size:18px;font-weight:500">Timeline</h2>`

  if (dateLogs.length === 0) {
    blocks.push(
      makeBlock(
        `${timelineHeading}<p style="margin:0;color:#424940">No log entries.</p>`,
      ),
    )
  } else {
    dateLogs.forEach((log, i) => {
      const item = `
        <div style="border-top:1px solid #c2c9bd;padding-top:16px">
          <div style="font-size:12px;font-weight:700;color:#424940">${formatLogDate(
            log.log_date,
          )}</div>
          <p style="white-space:pre-wrap;margin:6px 0 0">${esc(log.status_details)}</p>
          ${
            log.image_url
              ? `<img src="${esc(
                  log.image_url,
                )}" style="display:block;margin-top:10px;max-width:100%;max-height:360px;object-fit:cover;border-radius:12px" />`
              : ''
          }
        </div>`
      // Keep the "Timeline" heading attached to the first entry so it never
      // orphans at the foot of a page.
      blocks.push(makeBlock(i === 0 ? timelineHeading + item : item))
    })
  }

  for (const block of blocks) container.appendChild(block)
  return { container, blocks }
}

/** Rasterise one block; returns its JPEG data and height scaled to `contentW` mm. */
async function renderBlock(block: HTMLElement, contentW: number) {
  const canvas = await html2canvas(block, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: TEMPLATE_WIDTH,
  })
  return {
    data: canvas.toDataURL('image/jpeg', 0.92),
    heightMm: (canvas.height * contentW) / canvas.width,
    canvas,
  }
}

/**
 * Render a hidden HTML template of the experiment + its logs and download it as
 * a multi-page A4 PDF with uniform margins, breaking pages between blocks so no
 * text or image is split across a page boundary.
 */
export async function exportExperimentToPDF(
  experiment: Experiment,
  dateLogs: DateLog[],
) {
  // Logs oldest-first for a chronological read.
  const ordered = [...dateLogs].sort((a, b) => {
    if (a.log_date !== b.log_date) return a.log_date < b.log_date ? -1 : 1
    return a.created_at < b.created_at ? -1 : 1
  })

  const { container, blocks } = buildTemplate(experiment, ordered)
  document.body.appendChild(container)

  try {
    await waitForImages(container)

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const contentW = pageW - MARGIN * 2
    const contentH = pageH - MARGIN * 2
    const bottom = MARGIN + contentH

    let cursorY = MARGIN
    let pageHasContent = false

    for (const block of blocks) {
      const { data, heightMm, canvas } = await renderBlock(block, contentW)

      if (heightMm <= contentH + 0.01) {
        // Fits on a page: move to a fresh page if it won't fit in what's left.
        if (pageHasContent && cursorY + heightMm > bottom + 0.01) {
          doc.addPage()
          cursorY = MARGIN
          pageHasContent = false
        }
        doc.addImage(data, 'JPEG', MARGIN, cursorY, contentW, heightMm)
        cursorY += heightMm + BLOCK_GAP
        pageHasContent = true
        continue
      }

      // Rare: a single block taller than a full page. Slice it into page-height
      // pieces, each drawn within the margins on its own page.
      if (pageHasContent) {
        doc.addPage()
        cursorY = MARGIN
      }
      const pxPerMm = canvas.width / contentW
      const slicePx = Math.floor(contentH * pxPerMm)
      let sy = 0
      let lastSliceMm = 0
      while (sy < canvas.height) {
        const sliceH = Math.min(slicePx, canvas.height - sy)
        const tmp = document.createElement('canvas')
        tmp.width = canvas.width
        tmp.height = sliceH
        tmp
          .getContext('2d')!
          .drawImage(canvas, 0, sy, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
        if (sy > 0) doc.addPage()
        lastSliceMm = sliceH / pxPerMm
        doc.addImage(
          tmp.toDataURL('image/jpeg', 0.92),
          'JPEG',
          MARGIN,
          MARGIN,
          contentW,
          lastSliceMm,
        )
        sy += sliceH
      }
      cursorY = MARGIN + lastSliceMm + BLOCK_GAP
      pageHasContent = true
    }

    const stamp = new Date().toISOString().slice(0, 10)
    doc.save(`${slugify(experiment.title)}-${stamp}.pdf`)
  } finally {
    container.remove()
  }
}
