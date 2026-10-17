import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type {
  DateLog,
  Experiment,
  Folder,
  Pot,
  Potting,
} from '../../types/database'
import {
  phase1Remaining,
  phase2Alive,
  potAlive,
  type PhaseInput,
} from './phases'
import { stageEntry } from './stages'
import { formatRate, successRate, survivorCount, totalDeaths } from './survival'

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
  // Generous line-height + padding: html2canvas otherwise clips the top/bottom
  // of glyphs when text sits flush against the element box.
  block.style.cssText =
    'width:100%;box-sizing:border-box;padding:4px 6px 12px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word'
  block.innerHTML = html
  return block
}

/**
 * Build the off-screen template as a list of self-contained blocks. Each block
 * is rasterised separately so the PDF can page-break *between* blocks instead of
 * slicing through text or an image.
 */
function buildTemplate(
  experiment: Experiment,
  dateLogs: DateLog[],
  folder: Folder | null | undefined,
  pottings: Potting[],
  pots: Pot[],
) {
  // Batch facts live on the folder now; fall back to any legacy values still on
  // the experiment row.
  const plantCount = folder?.plant_count ?? experiment.plant_count
  const origin = folder?.origin ?? experiment.origin
  const initialPrice = folder?.initial_price ?? experiment.initial_price
  const coverUrl = folder?.cover_image_url ?? experiment.cover_image_url
  const container = document.createElement('div')
  container.style.cssText = [
    'position:absolute',
    'left:-10000px',
    'top:0',
    `width:${TEMPLATE_WIDTH}px`,
    'padding:0',
    'background:#ffffff',
    'color:#1a1c19',
    "font-family:'Roboto',system-ui,'Segoe UI',sans-serif",
    'font-size:14px',
    'line-height:1.7',
  ].join(';')

  const blocks: HTMLElement[] = []

  blocks.push(
    makeBlock(
      `<h1 style="margin:0 0 4px;font-size:26px;font-weight:500">${esc(
        experiment.title,
      )}</h1>
       <div style="color:#424940;font-size:13px">${
         folder ? `${esc(folder.title)} — ` : ''
       }plant experiment history</div>`,
    ),
  )

  if (coverUrl) {
    // Centered, natural aspect ratio (no horizontal stretch), capped to a
    // compact near-square footprint.
    blocks.push(
      makeBlock(
        `<div style="text-align:center">
          <img src="${esc(
            coverUrl,
          )}" style="max-width:340px;max-height:340px;width:auto;height:auto;border-radius:12px" />
        </div>`,
      ),
    )
  }

  const deaths = totalDeaths(dateLogs)
  const initialForRate = experiment.plant_count ?? plantCount ?? null

  const facts: string[] = []
  if (folder) facts.push(`<strong>Folder:</strong> ${esc(folder.title)}`)
  if (plantCount != null) {
    facts.push(`<strong>Plants:</strong> ${esc(String(plantCount))}`)
  }
  if (initialForRate != null) {
    facts.push(
      `<strong>Surviving:</strong> ${survivorCount(
        initialForRate,
        deaths,
      )}/${initialForRate} (${formatRate(successRate(initialForRate, deaths))})`,
    )
  }
  const hasPottings = pottings.length > 0
  const phaseInput: PhaseInput = {
    experiment: { plant_count: experiment.plant_count },
    pottings,
    pots,
    logs: dateLogs,
  }
  if (hasPottings && experiment.plant_count != null) {
    const inPropagation = phase1Remaining(phaseInput, '9999-12-31') ?? 0
    facts.push(
      `<strong>Now:</strong> in propagation ${inPropagation} · potted ${phase2Alive(
        phaseInput,
      )} · died ${deaths}`,
    )
  }
  if (experiment.status) {
    facts.push(`<strong>Status:</strong> ${esc(experiment.status)}`)
  }
  if (origin) facts.push(`<strong>Origin:</strong> ${esc(origin)}`)
  if (initialPrice != null) {
    facts.push(`<strong>Initial price:</strong> $${initialPrice.toFixed(2)}`)
  }
  if (experiment.started_on) {
    facts.push(`<strong>Started:</strong> ${formatLogDate(experiment.started_on)}`)
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

  const phase1Logs = dateLogs.filter((l) => l.phase !== 'potted')
  const potLogs = dateLogs.filter((l) => l.phase === 'potted')
  const potLabels = new Map(pots.map((p) => [p.id, p.label]))

  const heading = (text: string) =>
    `<h2 style="margin:0 0 12px;font-size:18px;font-weight:500">${text}</h2>`
  const subheading = (text: string) =>
    `<h3 style="margin:0 0 8px;font-size:15px;font-weight:500">${text}</h3>`

  // Without pottings the PDF is exactly the single "Timeline" it always was.
  const timelineHeading = heading(
    hasPottings ? 'Phase 1 — Propagation timeline' : 'Timeline',
  )

  // A heading stays attached to the first block under it so it never orphans
  // at the foot of a page.
  const pushList = (items: string[], head: string, emptyText: string) => {
    if (items.length === 0) {
      blocks.push(
        makeBlock(`${head}<p style="margin:0;color:#424940">${emptyText}</p>`),
      )
      return
    }
    items.forEach((item, i) =>
      blocks.push(makeBlock(i === 0 ? head + item : item)),
    )
  }

  const photo = (url: string | null) =>
    url
      ? `<img src="${esc(
          url,
        )}" style="display:block;margin-top:10px;max-width:100%;max-height:360px;object-fit:cover;border-radius:12px" />`
      : ''

  const deathText = (log: DateLog) =>
    `${esc(String(log.deaths_count))} died${
      log.death_cause ? ` (${esc(log.death_cause)})` : ''
    }`

  const logItem = (log: DateLog, metrics: string[]) => `
        <div style="border-top:1px solid #c2c9bd;padding-top:16px">
          <div style="font-size:12px;font-weight:700;color:#424940">${formatLogDate(
            log.log_date,
          )}</div>
          ${
            log.status_details
              ? `<p style="white-space:pre-wrap;margin:6px 0 0">${esc(
                  log.status_details,
                )}</p>`
              : ''
          }
          ${
            metrics.length > 0
              ? `<div style="margin-top:6px;font-size:12px;color:#424940">${metrics.join(
                  ' &nbsp;·&nbsp; ',
                )}</div>`
              : ''
          }
          ${photo(log.image_url)}
        </div>`

  const phase1Items = phase1Logs.map((log) => {
    const metrics: string[] = []
    const stage = stageEntry(log)
    if (stage) {
      metrics.push(`Roots R0/R1/R2 ${stage.root.join(' / ')}`)
      metrics.push(`Shoots S0/S1/S2/S3 ${stage.shoot.join(' / ')}`)
      if (stage.leafingWithoutRooting > 0)
        metrics.push(`${stage.leafingWithoutRooting} leafing without rooting`)
    }
    if (log.deaths_count > 0) metrics.push(deathText(log))
    return logItem(log, metrics)
  })
  pushList(phase1Items, timelineHeading, 'No log entries.')

  if (hasPottings) {
    const livePots = pots.filter((p) => !p.deleted_at)
    const potsOf = (t: Potting) => livePots.filter((p) => p.potting_id === t.id)
    const plantsIn = (list: Pot[]) =>
      list.reduce((sum, p) => sum + p.plant_count, 0)
    const plantWord = (n: number) => (n === 1 ? 'plant' : 'plants')
    const potWord = (n: number) => (n === 1 ? 'pot' : 'pots')
    const sortedPottings = [...pottings].sort((a, b) =>
      a.potted_on.localeCompare(b.potted_on),
    )

    // Potting events.
    const eventItems = sortedPottings.map((t) => {
      const mine = potsOf(t)
      const plants = plantsIn(mine)
      return `
        <div style="border-top:1px solid #c2c9bd;padding-top:12px">
          <div style="font-size:13px"><strong>${formatLogDate(
            t.potted_on,
          )}</strong> — potted ${plants} ${plantWord(plants)} into ${
            mine.length
          } ${potWord(mine.length)}</div>
          ${
            t.notes
              ? `<p style="white-space:pre-wrap;margin:4px 0 0;font-size:12px;color:#424940">${esc(
                  t.notes,
                )}</p>`
              : ''
          }
        </div>`
    })
    const pottedTotal = plantsIn(livePots)
    pushList(
      eventItems,
      heading('Phase 2 — Potted') +
        `<p style="margin:0 0 12px;font-size:13px;color:#424940">${pottedTotal} ${plantWord(
          pottedTotal,
        )} potted into ${livePots.length} ${potWord(
          livePots.length,
        )} · ${phase2Alive(phaseInput)} alive now</p>` +
        subheading('Potting events'),
      'No potting events.',
    )

    // Pot list: one block per pot so a photo never splits across pages.
    const lastLog = new Map<string, string>()
    for (const l of potLogs) {
      if (l.pot_id && (lastLog.get(l.pot_id) ?? '') < l.log_date)
        lastLog.set(l.pot_id, l.log_date)
    }
    const dateOf = new Map(sortedPottings.map((t) => [t.id, t.potted_on]))
    const orderedPots = [...livePots].sort(
      (a, b) =>
        (dateOf.get(a.potting_id) ?? '').localeCompare(
          dateOf.get(b.potting_id) ?? '',
        ) || a.created_at.localeCompare(b.created_at),
    )
    const potItems = orderedPots.map((pot) => {
      const details: string[] = [
        `${potAlive(phaseInput, pot)} alive of ${pot.plant_count} ${plantWord(
          pot.plant_count,
        )}`,
      ]
      const pottedOn = dateOf.get(pot.potting_id)
      if (pottedOn) details.push(`potted ${formatLogDate(pottedOn)}`)
      if (pot.pot_size) details.push(`size ${esc(pot.pot_size)}`)
      if (pot.substrate) details.push(`substrate ${esc(pot.substrate)}`)
      const last = lastLog.get(pot.id)
      details.push(
        last ? `last check-in ${formatLogDate(last)}` : 'no check-ins yet',
      )
      return `
        <div style="border-top:1px solid #c2c9bd;padding-top:12px;display:flex;gap:16px;align-items:flex-start">
          ${
            pot.image_url
              ? `<img src="${esc(
                  pot.image_url,
                )}" style="width:150px;height:150px;object-fit:cover;border-radius:12px;flex:none" />`
              : ''
          }
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:700">${esc(pot.label)}</div>
            <div style="margin-top:4px;font-size:12px;color:#424940">${details.join(
              ' &nbsp;·&nbsp; ',
            )}</div>
            ${
              pot.notes
                ? `<p style="white-space:pre-wrap;margin:6px 0 0;font-size:12px">${esc(
                    pot.notes,
                  )}</p>`
                : ''
            }
          </div>
        </div>`
    })
    if (potItems.length > 0) pushList(potItems, subheading('Pots'), '')

    // Phase 2 timeline: every check-in belongs to a pot.
    const potTimeline = potLogs.map((log) => {
      const metrics: string[] = [
        `<strong>${esc(potLabels.get(log.pot_id ?? '') ?? 'Pot')}</strong>`,
      ]
      if (
        log.health_good != null ||
        log.health_ok != null ||
        log.health_poor != null
      ) {
        metrics.push(
          `Health good/ok/poor ${log.health_good ?? 0} / ${
            log.health_ok ?? 0
          } / ${log.health_poor ?? 0}`,
        )
      }
      if (log.watered) metrics.push('Watered')
      if (log.fertilized) metrics.push('Fertilized')
      if (log.deaths_count > 0) metrics.push(deathText(log))
      return logItem(log, metrics)
    })
    pushList(
      potTimeline,
      heading('Phase 2 — Potted timeline'),
      'No pot check-ins yet.',
    )
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
  folder?: Folder | null,
  pottings: Potting[] = [],
  pots: Pot[] = [],
) {
  // Logs oldest-first for a chronological read.
  const ordered = [...dateLogs].sort((a, b) => {
    if (a.log_date !== b.log_date) return a.log_date < b.log_date ? -1 : 1
    return a.created_at < b.created_at ? -1 : 1
  })

  const { container, blocks } = buildTemplate(
    experiment,
    ordered,
    folder,
    pottings,
    pots,
  )
  document.body.appendChild(container)

  try {
    // Fonts must be ready before rasterising, or html2canvas measures glyphs
    // with fallback metrics and clips the text.
    if (document.fonts?.ready) await document.fonts.ready
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
