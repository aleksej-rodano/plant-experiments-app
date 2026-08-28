import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { DateLog, Experiment } from '../../types/database'

/** A4 at ~96dpi, in CSS px — the render width of the hidden template. */
const TEMPLATE_WIDTH = 794

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

function buildTemplate(experiment: Experiment, dateLogs: DateLog[]) {
  const node = document.createElement('div')
  node.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${TEMPLATE_WIDTH}px`,
    'padding:48px',
    'box-sizing:border-box',
    'background:#ffffff',
    'color:#1a1c19',
    "font-family:'Roboto',system-ui,'Segoe UI',sans-serif",
    'font-size:14px',
    'line-height:1.5',
  ].join(';')

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

  const cover = experiment.cover_image_url
    ? `<img src="${esc(experiment.cover_image_url)}" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px;margin-bottom:24px" />`
    : ''

  const notes = experiment.notes
    ? `<p style="white-space:pre-wrap;margin:16px 0 0;padding:12px 16px;background:#f0f1ec;border-radius:12px">${esc(
        experiment.notes,
      )}</p>`
    : ''

  const logsHtml = dateLogs.length
    ? dateLogs
        .map(
          (log) => `
          <li style="padding:16px 0;border-top:1px solid #c2c9bd">
            <div style="font-size:12px;font-weight:700;color:#424940">${formatLogDate(
              log.log_date,
            )}</div>
            <p style="white-space:pre-wrap;margin:6px 0 0">${esc(log.status_details)}</p>
            ${
              log.image_url
                ? `<img src="${esc(
                    log.image_url,
                  )}" style="margin-top:10px;max-width:100%;max-height:360px;object-fit:cover;border-radius:12px" />`
                : ''
            }
          </li>`,
        )
        .join('')
    : '<li style="padding:16px 0;border-top:1px solid #c2c9bd;color:#424940">No log entries.</li>'

  node.innerHTML = `
    <h1 style="margin:0 0 4px;font-size:26px;font-weight:500">${esc(experiment.title)}</h1>
    <div style="color:#424940;font-size:13px;margin-bottom:24px">Plant experiment history</div>
    ${cover}
    <div style="display:flex;flex-wrap:wrap;gap:8px 24px;font-size:13px">
      ${facts.map((f) => `<div>${f}</div>`).join('')}
    </div>
    ${notes}
    <h2 style="margin:32px 0 0;font-size:18px;font-weight:500">Timeline</h2>
    <ul style="list-style:none;margin:8px 0 0;padding:0">${logsHtml}</ul>
  `

  return node
}

/**
 * Render a hidden HTML template of the experiment + its logs, rasterise it with
 * html2canvas, and download it as a multi-page A4 PDF.
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

  const node = buildTemplate(experiment, ordered)
  document.body.appendChild(node)

  try {
    await waitForImages(node)

    const canvas = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: TEMPLATE_WIDTH,
    })

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const imgH = (canvas.height * pageW) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    let heightLeft = imgH
    let position = 0
    doc.addImage(imgData, 'JPEG', 0, position, pageW, imgH)
    heightLeft -= pageH

    while (heightLeft > 0) {
      position -= pageH
      doc.addPage()
      doc.addImage(imgData, 'JPEG', 0, position, pageW, imgH)
      heightLeft -= pageH
    }

    const stamp = new Date().toISOString().slice(0, 10)
    doc.save(`${slugify(experiment.title)}-${stamp}.pdf`)
  } finally {
    node.remove()
  }
}
